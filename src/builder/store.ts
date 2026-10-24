import { create } from "zustand";
import { toast } from "sonner";
import * as ops from "./ops";
import { createSeed } from "./seed";
import { localRepository } from "./save-service";
import { canMoveTo, withStatus } from "./status";
import { validate } from "./validation";
import { startedCount } from "@/attempts/db";
import { contentKey } from "@/attempts/rules";
import type { Assignment, AssignmentStatus, ID, InsertTarget, Selection, ToolKey } from "./types";

export const snapshotOf = (a: Assignment) => JSON.stringify({ ...a, updatedAt: "" });

export interface ConfirmAction {
  label: string;
  variant?: "default" | "destructive" | "outline";
  run: () => void;
}
export interface ConfirmState {
  title: string;
  description: string;
  actions: ConfirmAction[];
}

interface BuilderState {
  assignment: Assignment;
  savedSnapshot: string;
  loaded: boolean;
  selection: Selection;
  mode: "edit" | "preview";
  saveStatus: "idle" | "saving" | "error";
  saveError: string | null;
  lastSavedAt: string | null;
  autosave: boolean;
  simulateFailure: boolean;
  confirm: ConfirmState | null;
  settingsOpen: boolean;
  /** Students who have started this assignment; > 0 freezes question content. */
  startedCount: number;
  refreshLock: () => void;

  load: (a: Assignment) => void;
  mutate: (fn: (draft: Assignment) => void) => void;
  select: (s: Selection) => void;
  set: (p: Partial<BuilderState>) => void;
  save: () => Promise<boolean>;
  /** Changes Draft / Published / Archived and saves; publishing is blocked while there are errors. */
  setStatus: (to: AssignmentStatus) => Promise<boolean>;
  addTool: (tool: ToolKey, target?: InsertTarget | null, count?: number) => void;
  requestDeleteItem: (id: ID) => void;
  requestDeleteSection: (id: ID) => void;
  duplicate: (id: ID) => void;
  ask: (c: ConfirmState) => void;
}

const seed = createSeed();

export const useBuilder = create<BuilderState>((set, get) => ({
  assignment: seed,
  savedSnapshot: snapshotOf(seed),
  loaded: false,
  selection: null,
  mode: "edit",
  saveStatus: "idle",
  saveError: null,
  lastSavedAt: null,
  autosave: true,
  simulateFailure: false,
  confirm: null,
  settingsOpen: false,
  startedCount: 0,
  refreshLock: () => set({ startedCount: startedCount(get().assignment.id) }),

  load: (a) => set({ startedCount: startedCount(a.id), assignment: a, savedSnapshot: snapshotOf(a), loaded: true, selection: null, saveStatus: "idle", lastSavedAt: a.updatedAt }),
  mutate: (fn) => {
    const cur = get().assignment;
    const draft = structuredClone(cur);
    fn(draft);
    if (get().startedCount > 0 && contentKey(draft) !== contentKey(cur)) {
      toast.error("Nội dung đề đã bị khóa vì học sinh đã bắt đầu làm bài. Hãy nhân bản bài để sửa.", { id: "content-locked" });
      return;
    }
    set({ assignment: draft });
  },
  select: (selection) => set({ selection }),
  set: (p) => set(p),
  ask: (confirm) => set({ confirm }),

  save: async () => {
    if (get().saveStatus === "saving") return false;
    const a = get().assignment;
    set({ saveStatus: "saving", saveError: null });
    try {
      const saved = await localRepository.save(a, { simulateFailure: get().simulateFailure });
      set({ saveStatus: "idle", savedSnapshot: snapshotOf(a), lastSavedAt: saved.updatedAt });
      return true;
    } catch (e) {
      set({ saveStatus: "error", saveError: (e as Error).message });
      return false;
    }
  },

  setStatus: async (to) => {
    const before = get().assignment;
    const errors = validate(before).filter((i) => i.level === "error").length;
    const check = canMoveTo(to, errors);
    if (!check.ok) {
      toast.error(check.reason);
      return false;
    }
    set({ assignment: withStatus(before, to) });
    const ok = await get().save();
    if (!ok) {
      set({ assignment: { ...get().assignment, status: before.status ?? "draft", publishedAt: before.publishedAt ?? null } });
      toast.error("Could not change status — please retry");
      return false;
    }
    toast.success(to === "published" ? "Published — students can now see it" : to === "archived" ? "Archived — hidden from students" : "Moved back to draft");
    return true;
  },

  addTool: (tool, target, count = 1) => {
    const { selection } = get();
    if (tool === "SECTION") {
      const s = ops.newSection();
      get().mutate((d) => {
        const cur = selection ? (selection.kind === "section" ? selection.id : ops.locate(d, selection.id)?.sectionId) : null;
        const idx = cur ? d.sections.findIndex((x) => x.id === cur) + 1 : d.sections.length;
        d.sections.splice(idx, 0, s);
      });
      set({ selection: { kind: "section", id: s.id } });
      return;
    }
    const n = Math.max(1, Math.min(50, Math.floor(count || 1)));
    const items = Array.from({ length: n }, () => ops.createItem(tool));
    get().mutate((d) => {
      let t = target ?? ops.targetFromSelection(d, selection, items[0]!.kind === "block");
      if (!t) {
        const s = ops.newSection();
        d.sections.push(s);
        t = { sectionId: s.id, groupId: null, index: 0 };
      }
      items.forEach((item, i) => {
        d.items[item.id] = item;
        ops.place(d, item.id, { ...t!, index: t!.index + i });
      });
    });
    const first = items[0]!;
    set({ selection: { kind: "item", id: first.id } });
    if (n > 1) toast.success(`Added ${n} questions`);
    setTimeout(() => document.getElementById(`item-${first.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  },

  duplicate: (id) => {
    let nid: ID | null = null;
    get().mutate((d) => (nid = ops.duplicateItem(d, id)));
    if (nid) set({ selection: { kind: "item", id: nid } });
    toast.success("Duplicated");
  },

  requestDeleteItem: (id) => {
    const a = get().assignment;
    const it = a.items[id];
    if (!it) return;
    const done = () => {
      if (get().selection?.id === id) set({ selection: null });
    };
    if (it.kind === "block" && it.memberIds.length) {
      get().ask({
        title: `Delete "${ops.blockLabel(it)}"?`,
        description: `This shared block owns ${it.memberIds.length} question(s). Delete them too, or keep them as standalone questions?`,
        actions: [
          { label: "Ungroup & keep questions", variant: "outline", run: () => (get().mutate((d) => ops.removeItem(d, id, false)), done()) },
          { label: "Delete with members", variant: "destructive", run: () => (get().mutate((d) => ops.removeItem(d, id, true)), done()) },
        ],
      });
      return;
    }
    get().mutate((d) => ops.removeItem(d, id));
    done();
    toast("Item deleted");
  },

  requestDeleteSection: (id) => {
    const s = get().assignment.sections.find((x) => x.id === id);
    if (!s) return;
    const run = () => {
      get().mutate((d) => ops.removeSection(d, id));
      if (get().selection?.id === id) set({ selection: null });
    };
    if (s.itemIds.length === 0) return run();
    get().ask({
      title: `Delete section "${s.titleEn || "Untitled"}"?`,
      description: "All items in this section will be deleted.",
      actions: [{ label: "Delete section", variant: "destructive", run }],
    });
  },
}));

export function useIsDirty() {
  return useBuilder((s) => snapshotOf(s.assignment) !== s.savedSnapshot);
}

export async function loadAssignment(id?: string) {
  const all = await localRepository.list();
  const a = (id && (await localRepository.get(id))) || all[0] || createSeed();
  useBuilder.getState().load(a);
}
