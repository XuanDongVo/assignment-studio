// @ts-nocheck -- prototype: strict index-access checks relaxed
import { Archive, Check, ChevronDown, FilePen, Globe, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STATUS_HINT, STATUS_LABEL, statusOf } from "../status";
import { useBuilder } from "../store";
import type { AssignmentStatus } from "../types";
import { useIssues } from "./Canvas";
import { goToIssue } from "./ValidationPanel";

const ICON: Record<AssignmentStatus, typeof Globe> = { draft: FilePen, published: Globe, archived: Archive };

/** Coloured pill showing the current status; reused on the assignments list. */
export function StatusPill({ status, className }: { status: AssignmentStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap",
        status === "published" && "border-success/30 bg-success/10 text-success",
        status === "draft" && "border-border bg-muted text-muted-foreground",
        status === "archived" && "border-border bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" /> {STATUS_LABEL[status]}
    </span>
  );
}

export function useStatusActions() {
  const { setStatus, ask } = useBuilder.getState();
  const issues = useIssues();
  const errors = issues.filter((i) => i.level === "error");
  const title = useBuilder((s) => s.assignment.title);

  const publish = () => {
    if (errors.length) {
      ask({
        title: `Fix ${errors.length} error(s) before publishing`,
        description: "Students cannot receive an assignment with missing answers or broken links. You can still save it as a draft.",
        actions: [{ label: "Go to first error", run: () => goToIssue(errors[0]) }],
      });
      return;
    }
    ask({
      title: "Publish this assignment?",
      description: `"${title}" will become visible to the assigned classes. Unsaved changes are saved first.`,
      actions: [{ label: "Publish now", run: () => setStatus("published") }],
    });
  };
  const toDraft = () =>
    ask({
      title: "Move back to draft?",
      description: "Students will no longer see it until you publish again.",
      actions: [{ label: "Move to draft", variant: "outline", run: () => setStatus("draft") }],
    });
  const archive = () =>
    ask({
      title: "Archive this assignment?",
      description: "It is hidden from students and moved to the Archived list. You can restore it at any time.",
      actions: [{ label: "Archive", variant: "destructive", run: () => setStatus("archived") }],
    });
  const go = (to: AssignmentStatus) => (to === "published" ? publish() : to === "draft" ? toDraft() : archive());
  return { go, errors: errors.length };
}

/** Big, always-visible publish control in the header: main action button + status menu. */
export function PublishControl() {
  const status = useBuilder((s) => statusOf(s.assignment));
  const saving = useBuilder((s) => s.saveStatus === "saving");
  const { go, errors } = useStatusActions();

  const main =
    status === "draft" ? (
      <Button size="sm" onClick={() => go("published")} disabled={saving} className="rounded-r-none" title={errors ? `${errors} error(s) to fix first` : "Publish to students"}>
        <Send className="h-4 w-4" /> Publish
        {errors > 0 && <span className="ml-0.5 rounded-full bg-destructive px-1.5 text-[10px] leading-4 text-destructive-foreground">{errors}</span>}
      </Button>
    ) : status === "published" ? (
      <Button size="sm" variant="outline" onClick={() => go("draft")} disabled={saving} className="rounded-r-none border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success" title="Published — click to move back to draft">
        <Globe className="h-4 w-4" /> Published
      </Button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => go("draft")} disabled={saving} className="rounded-r-none" title="Restore to draft">
        <RotateCcw className="h-4 w-4" /> Restore
      </Button>
    );

  return (
    <div data-tour="publish" className="flex items-center">
      {main}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant={status === "draft" ? "default" : "outline"}
            className={cn("rounded-l-none border-l px-1.5", status === "draft" && "border-primary-foreground/25", status === "published" && "border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success")}
            aria-label="Change status"
            disabled={saving}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Assignment status</DropdownMenuLabel>
          {(["draft", "published", "archived"] as const).map((s) => {
            const Icon = ICON[s];
            const current = s === status;
            const blocked = s === "published" && errors > 0 && !current;
            return (
              <DropdownMenuItem key={s} onClick={() => !current && go(s)} className={cn("items-start gap-2.5 py-2", current && "bg-accent")}>
                <Icon className={cn("mt-0.5 h-4 w-4", s === "published" && "text-success")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {STATUS_LABEL[s]}
                    {blocked && <span className="text-xs font-normal text-destructive">· {errors} error(s)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{STATUS_HINT[s]}</div>
                </div>
                {current && <Check className="mt-0.5 h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Publishing needs zero errors. Drafts can be saved anytime.</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Thin strip under the header so the current state is impossible to miss. */
export function StatusBanner() {
  const status = useBuilder((s) => statusOf(s.assignment));
  const publishedAt = useBuilder((s) => s.assignment.publishedAt);
  const { go } = useStatusActions();
  if (status === "draft") return null;
  if (status === "published")
    return (
      <div className="flex items-center gap-2 border-b border-success/30 bg-success/10 px-4 py-1.5 text-sm text-success">
        <Globe className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          <b>Published</b> — assigned classes can see this{publishedAt ? ` since ${new Date(publishedAt).toLocaleString()}` : ""}. Saved changes go live immediately.
        </span>
        <button onClick={() => go("draft")} className="shrink-0 text-xs font-semibold underline">Unpublish</button>
      </div>
    );
  return (
    <div className="flex items-center gap-2 border-b bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
      <Archive className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate"><b>Archived</b> — hidden from students. Restore it to draft to reuse or publish again.</span>
      <button onClick={() => go("draft")} className="shrink-0 text-xs font-semibold underline">Restore to draft</button>
    </div>
  );
}
