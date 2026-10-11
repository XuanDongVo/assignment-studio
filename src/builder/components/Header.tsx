// @ts-nocheck -- prototype: strict index-access checks relaxed
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Eye, Loader2, MoreHorizontal, PencilLine, Save, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { uid } from "../ops";
import { localRepository } from "../save-service";
import { useBuilder, useIsDirty } from "../store";
import { useIssues } from "./Canvas";

export function StatusBadge() {
  const dirty = useIsDirty();
  const status = useBuilder((s) => s.saveStatus);
  const lastSavedAt = useBuilder((s) => s.lastSavedAt);
  const save = useBuilder((s) => s.save);
  const base = "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap";
  if (status === "saving") return <span className={cn(base, "border-primary/30 bg-primary/5 text-primary")}><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (status === "error")
    return (
      <span className={cn(base, "border-destructive/30 bg-destructive/5 text-destructive")}>
        Save failed
        <button onClick={() => save()} className="font-semibold underline">Retry</button>
      </span>
    );
  if (dirty) return <span className={cn(base, "border-warning/40 bg-warning/10 text-warning-foreground")}><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes</span>;
  if (lastSavedAt) return <span className={cn(base, "border-success/30 bg-success/10 text-success")} title={new Date(lastSavedAt).toLocaleString()}><span className="h-1.5 w-1.5 rounded-full bg-success" /> Saved</span>;
  return <span className={cn(base, "text-muted-foreground")}>Draft</span>;
}

export function Header() {
  const navigate = useNavigate();
  const a = useBuilder((s) => s.assignment);
  const mode = useBuilder((s) => s.mode);
  const autosave = useBuilder((s) => s.autosave);
  const simulateFailure = useBuilder((s) => s.simulateFailure);
  const status = useBuilder((s) => s.saveStatus);
  const { set, mutate, save, ask } = useBuilder.getState();
  const dirty = useIsDirty();
  const errors = useIssues().filter((i) => i.level === "error").length;

  const leave = () => navigate({ to: "/assignments" });
  const onBack = () => {
    if (!dirty) return leave();
    ask({
      title: "Leave with unsaved changes?",
      description: "Your latest edits have not been saved yet.",
      actions: [
        { label: "Leave without saving", variant: "outline", run: () => (set({ savedSnapshot: "" }), useBuilder.getState().load(useBuilder.getState().assignment), leave()) },
        { label: "Save & leave", run: async () => ((await save()) ? leave() : toast.error("Save failed — still here")) },
      ],
    });
  };

  const duplicateAssignment = async () => {
    const copy = { ...structuredClone(a), id: uid("asg"), title: `${a.title} (copy)` };
    await localRepository.save(copy);
    toast.success("Assignment duplicated — opening the copy");
    navigate({ to: "/", search: { id: copy.id } });
  };
  const deleteAssignment = () =>
    ask({
      title: "Delete this assignment?",
      description: `"${a.title}" and all of its questions will be permanently removed.`,
      actions: [
        {
          label: "Delete assignment",
          variant: "destructive",
          run: async () => {
            await localRepository.remove(a.id);
            useBuilder.getState().load(a); // clear dirty state so leaving is not blocked
            toast("Assignment deleted");
            leave();
          },
        },
      ],
    });

  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back to assignments" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <input
          aria-label="Assignment title"
          value={a.title}
          onChange={(e) => mutate((d) => (d.title = e.target.value))}
          placeholder="Untitled assignment"
          className="h-8 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 text-base font-semibold outline-none hover:border-border focus:border-primary"
        />
        <StatusBadge />
        <span className={cn("hidden whitespace-nowrap text-xs xl:inline", errors ? "text-destructive" : "text-success")}>{errors ? `${errors} error(s) before publishing` : "Ready to publish"}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex rounded-md border p-0.5" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "edit"} onClick={() => set({ mode: "edit" })} className={cn("flex h-7 items-center gap-1.5 rounded px-2.5 text-sm", mode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <PencilLine className="h-3.5 w-3.5" /> Edit
          </button>
          <button role="tab" aria-selected={mode === "preview"} onClick={() => set({ mode: "preview" })} className={cn("flex h-7 items-center gap-1.5 rounded px-2.5 text-sm", mode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Student </span>Preview
          </button>
        </div>
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => set({ settingsOpen: true })}><Settings className="h-4 w-4" /></Button>
        <Button size="sm" onClick={() => save()} disabled={status === "saving"} title="Save draft (Ctrl+S)">
          <Save className="h-4 w-4" /> Save Draft
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={duplicateAssignment}><Copy className="h-4 w-4" /> Duplicate assignment</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Saving</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={autosave} onCheckedChange={(v) => set({ autosave: !!v })}>Autosave (5s after last change)</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={simulateFailure} onCheckedChange={(v) => set({ simulateFailure: !!v })}>Simulate save failure</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={deleteAssignment}><Trash2 className="h-4 w-4" /> Delete assignment</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
