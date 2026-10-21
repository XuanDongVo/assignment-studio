import type { Assignment, ID } from "./types";
import { createSeed } from "./seed";
import { createDemo, DEMO_ID } from "./demo";

export interface AssignmentRepository {
  list(): Promise<Assignment[]>;
  get(id: ID): Promise<Assignment | null>;
  save(a: Assignment, opts?: { simulateFailure?: boolean }): Promise<Assignment>;
  remove(id: ID): Promise<void>;
}

const KEY = "ab.assignments.v1";
const DEMO_FLAG = "ab.demo.v1";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readAll(): Record<ID, Assignment> {
  let all: Record<ID, Assignment> | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) all = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!all) {
    const seed = createSeed();
    all = { [seed.id]: seed };
    writeAll(all);
  }
  // Add the showcase demo once; if the teacher deletes it, it stays deleted (can be re-added from the list page).
  if (!localStorage.getItem(DEMO_FLAG)) {
    if (!all[DEMO_ID]) all[DEMO_ID] = createDemo();
    writeAll(all);
    localStorage.setItem(DEMO_FLAG, "1");
  }
  return all;
}
const writeAll = (all: Record<ID, Assignment>) => localStorage.setItem(KEY, JSON.stringify(all));

/** Re-creates the showcase demo with its original content and returns its id. */
export async function resetDemo(): Promise<ID> {
  const all = readAll();
  all[DEMO_ID] = { ...createDemo(), updatedAt: new Date().toISOString() };
  writeAll(all);
  return DEMO_ID;
}

export const localRepository: AssignmentRepository = {
  async list() {
    await delay(150);
    return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    return readAll()[id] ?? null;
  },
  async save(a, opts) {
    await delay(600);
    if (opts?.simulateFailure) throw new Error("Network error (simulated). Your changes are still here.");
    const all = readAll();
    const saved = { ...a, updatedAt: new Date().toISOString() };
    all[a.id] = saved;
    writeAll(all);
    return saved;
  },
  async remove(id) {
    await delay(300);
    const all = readAll();
    delete all[id];
    writeAll(all);
  },
};
