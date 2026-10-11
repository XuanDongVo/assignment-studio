import type { Assignment, ID } from "./types";
import { createSeed } from "./seed";

export interface AssignmentRepository {
  list(): Promise<Assignment[]>;
  get(id: ID): Promise<Assignment | null>;
  save(a: Assignment, opts?: { simulateFailure?: boolean }): Promise<Assignment>;
  remove(id: ID): Promise<void>;
}

const KEY = "ab.assignments.v1";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readAll(): Record<ID, Assignment> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const seed = createSeed();
  const all = { [seed.id]: seed };
  localStorage.setItem(KEY, JSON.stringify(all));
  return all;
}
const writeAll = (all: Record<ID, Assignment>) => localStorage.setItem(KEY, JSON.stringify(all));

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
