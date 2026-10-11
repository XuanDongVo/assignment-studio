import { create } from "zustand";
import { toast } from "sonner";
import * as ops from "./ops";
import { createSeed } from "./seed";
import { localRepository } from "./save-service";
import type { Assignment, ID, InsertTarget, Selection, ToolKey } from "./types";

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

  load: (a: Assignment) => void;
  mutate: (fn: (draft: Assignment) => void) => void;
  select: (s: Selection) => void;
  set: (p: Partial<BuilderState>) => void;
  save: () => Promise<boolean>;
  addTool: (tool: ToolKey, target?: InsertTarget | null) => void;
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

  load: (a) => set({ assignment: a, savedSnapshot: snapshotOf(a), loaded: true, selection: null, saveStatus: "idle", lastSavedAt: a.updatedAt }),
  mutate: (fn) => {
    const draft = structuredClone(get().assignment);
    fn(draft);
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

  addTool: (tool, target) => {
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
    const item = ops.createItem(tool);
    get().mutate((d) => {
      let t = target ?? ops.targetFromSelection(d, selection, item.kind === "block");
      if (!t) {
        const s = ops.newSection();
        d.sections.push(s);
        t = { sectionId: s.id, groupId: null, index: 0 };
      }
      d.items[item.id] = item;
      ops.place(d, item.id, t);
    });
    set({ selection: { kind: "item", id: item.id } });
    setTimeout(() => document.getElementById(`item-${item.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
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
