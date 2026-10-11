import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_CLASSES } from "../seed";
import { useBuilder } from "../store";
import type { AssignmentSettings, ShowAnswers } from "../types";

export function SettingsSheet() {
  const open = useBuilder((s) => s.settingsOpen);
  const a = useBuilder((s) => s.assignment);
  const { set, mutate } = useBuilder.getState();
  const st = a.settings;
  const upd = (p: Partial<AssignmentSettings>) => mutate((d) => Object.assign(d.settings, p));
  const dateError = st.startAt && st.dueAt && st.dueAt <= st.startAt ? "Due date must be after the start date" : null;
  const timeError = st.timeLimitMin != null && (st.timeLimitMin <= 0 || !Number.isFinite(st.timeLimitMin)) ? "Time limit must be a positive number" : null;
  return (
    <Sheet open={open} onOpenChange={(o) => set({ settingsOpen: o })}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Assignment settings</SheetTitle>
          <SheetDescription>Changes apply to the draft immediately and are saved with it.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="set-title">Title</Label>
            <Input id="set-title" value={a.title} onChange={(e) => mutate((d) => (d.title = e.target.value))} />
            {!a.title.trim() && <p className="text-xs text-destructive">Title is required</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Grade</Label>
            <Select value={String(a.grade)} onValueChange={(v) => mutate((d) => (d.grade = Number(v) as 6 | 7 | 8))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[6, 7, 8].map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-ins">Instructions for students</Label>
            <Textarea id="set-ins" rows={3} value={a.instructions} onChange={(e) => mutate((d) => (d.instructions = e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-time">Time limit for the whole attempt (minutes)</Label>
            <Input id="set-time" type="number" min={1} placeholder="No limit" value={st.timeLimitMin ?? ""} onChange={(e) => upd({ timeLimitMin: e.target.value === "" ? null : Number(e.target.value) })} />
            {timeError ? <p className="text-xs text-destructive">{timeError}</p> : <p className="text-xs text-muted-foreground">Leave empty for no limit. There are no per-question timers.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="set-start">Start</Label>
              <Input id="set-start" type="datetime-local" value={st.startAt} onChange={(e) => upd({ startAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-due">Due</Label>
              <Input id="set-due" type="datetime-local" value={st.dueAt} aria-invalid={!!dateError} onChange={(e) => upd({ dueAt: e.target.value })} />
            </div>
            {dateError && <p className="col-span-2 text-xs text-destructive">{dateError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Target classes</Label>
            <div className="grid grid-cols-3 gap-2 rounded-md border p-3">
              {MOCK_CLASSES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={st.classIds.includes(c)} onCheckedChange={(v) => upd({ classIds: v ? [...st.classIds, c] : st.classIds.filter((x) => x !== c) })} />
                  {c}
                </label>
              ))}
            </div>
            {st.classIds.length === 0 && <p className="text-xs text-warning-foreground">No class selected yet</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Show answers to students</Label>
            <Select value={st.showAnswers} onValueChange={(v) => upd({ showAnswers: v as ShowAnswers })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Never</SelectItem>
                <SelectItem value="after_submission">After submission</SelectItem>
                <SelectItem value="after_due">After the due date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Show points per question</span>
            <Switch checked={st.showPoints} onCheckedChange={(v) => upd({ showPoints: v })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Shuffle questions within sections
              <span className="block text-xs text-muted-foreground">Off by default. Shared groups stay together.</span>
            </span>
            <Switch checked={st.shuffle} onCheckedChange={(v) => upd({ shuffle: v })} />
          </label>
        </div>
      </SheetContent>
    </Sheet>
  );
}
