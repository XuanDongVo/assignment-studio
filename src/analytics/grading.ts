// @ts-nocheck -- prototype: strict index-access checks relaxed
/** Turns an assignment into per-attempt question snapshots and grades raw answers part by part. */
import { blockLabel, computeNumbering, docOrder, letter } from "@/builder/ops";
import type { Assignment, BlockItem } from "@/builder/types";
import type { PartResult, PartStatus, QuestionSnapshot, RawAnswer } from "./types";

export const GRADER_VERSION = "auto-1.0";
export const MANUAL_GRADER = "teacher-manual";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same answer written differently counts as one: trims, single spaces, curly quotes, final full stop, case. */
export function normalizeAnswer(s: string, caseSensitive = false): string {
  const v = s
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .trim();
  return caseSensitive ? v : v.toLowerCase();
}

export function snapshotAssignment(a: Assignment): QuestionSnapshot[] {
  const { numbers } = computeNumbering(a);
  const out: QuestionSnapshot[] = [];
  for (const e of docOrder(a)) {
    const it = a.items[e.id];
    if (!it || it.kind !== "question") continue;
    const sec = a.sections.find((s) => s.id === e.sectionId);
    const grp = e.groupId ? (a.items[e.groupId] as BlockItem) : null;
    const c = it.content;
    const points = Number(it.config.points) || 0;
    const q: QuestionSnapshot = {
      questionId: it.id,
      number: numbers.get(it.id) ?? null,
      type: c.type,
      gradingMode: it.config.gradingMode,
      prompt: c.prompt,
      sectionId: e.sectionId,
      sectionTitle: sec?.titleEn || "Untitled section",
      groupLabel: grp ? blockLabel(grp) : null,
      points,
      isExample: it.config.isExample,
      parts: [{ key: "main", label: "", max: points }],
    };
    if (c.type === "SINGLE_CHOICE" || c.type === "MULTIPLE_CHOICE")
      q.options = c.options.map((o, i) => ({ id: o.id, letter: letter(i), text: o.text, isCorrect: o.isCorrect }));
    if (c.type === "TEXT_INPUT") Object.assign(q, { acceptedAnswers: [...c.acceptedAnswers], caseSensitive: c.caseSensitive });
    if (c.type === "MULTI_TEXT_INPUT") {
      q.caseSensitive = c.caseSensitive;
      q.blanks = c.blanks.map((b, i) => ({ key: `blank-${i + 1}`, acceptedAnswers: [...b.acceptedAnswers] }));
      const each = c.blanks.length ? points / c.blanks.length : 0;
      q.parts = q.blanks.map((b, i) => ({ key: b.key, label: `Chỗ trống ${i + 1}`, max: round2(each) }));
    }
    if (c.type === "MATCHING") {
      const pool = c.poolId ? (a.items[c.poolId] as BlockItem) : null;
      q.poolEntries = pool?.block.type === "POOL" ? pool.block.entries.map((en, i) => ({ id: en.id, letter: letter(i), text: en.text })) : [];
      q.correctEntryId = c.correctEntryId;
    }
    out.push(q);
  }
  return out;
}

const part = (key: string, max: number, status: PartStatus, earned: number, normalized: string | null, graderVersion = GRADER_VERSION): PartResult => ({
  key,
  status,
  earned: round2(earned),
  max,
  normalized,
  graderVersion,
});
const isBlank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Grades one answer. Manual questions need the teacher's score (0…points). */
export function gradeResponse(q: QuestionSnapshot, raw: RawAnswer, manualScore?: number): PartResult[] {
  const max = q.points;
  switch (q.type) {
    case "SINGLE_CHOICE": {
      if (isBlank(raw)) return [part("main", max, "UNANSWERED", 0, null)];
      const o = q.options!.find((x) => x.id === raw);
      return [part("main", max, o?.isCorrect ? "CORRECT" : "INCORRECT", o?.isCorrect ? max : 0, o?.letter ?? null)];
    }
    case "MULTIPLE_CHOICE": {
      const picked = (raw as string[] | null) ?? [];
      if (!picked.length) return [part("main", max, "UNANSWERED", 0, null)];
      const correct = q.options!.filter((o) => o.isCorrect).map((o) => o.id);
      const hits = picked.filter((id) => correct.includes(id)).length;
      const wrong = picked.length - hits;
      const frac = correct.length ? Math.max(0, (hits - wrong) / correct.length) : 0;
      const exact = hits === correct.length && wrong === 0;
      const letters = q.options!.filter((o) => picked.includes(o.id)).map((o) => o.letter).join(",");
      return [part("main", max, exact ? "CORRECT" : frac > 0 ? "PARTIAL" : "INCORRECT", exact ? max : max * frac, letters)];
    }
    case "TEXT_INPUT": {
      const text = (raw as string | null) ?? "";
      if (isBlank(text)) return [part("main", max, "UNANSWERED", 0, null, q.gradingMode === "MANUAL" ? MANUAL_GRADER : GRADER_VERSION)];
      const norm = normalizeAnswer(text, q.caseSensitive);
      if (q.gradingMode === "MANUAL") {
        const s = Math.max(0, Math.min(max, manualScore ?? 0));
        return [part("main", max, s >= max ? "CORRECT" : s > 0 ? "PARTIAL" : "INCORRECT", s, norm, MANUAL_GRADER)];
      }
      const ok = (q.acceptedAnswers ?? []).some((x) => normalizeAnswer(x, q.caseSensitive) === norm);
      return [part("main", max, ok ? "CORRECT" : "INCORRECT", ok ? max : 0, norm)];
    }
    case "MULTI_TEXT_INPUT": {
      const vals = (raw as string[] | null) ?? [];
      return q.blanks!.map((b, i) => {
        const pmax = q.parts[i]!.max;
        const v = vals[i] ?? "";
        if (isBlank(v)) return part(b.key, pmax, "UNANSWERED", 0, null);
        const norm = normalizeAnswer(v, q.caseSensitive);
        const ok = b.acceptedAnswers.some((x) => normalizeAnswer(x, q.caseSensitive) === norm);
        return part(b.key, pmax, ok ? "CORRECT" : "INCORRECT", ok ? pmax : 0, norm);
      });
    }
    case "MATCHING": {
      if (isBlank(raw)) return [part("main", max, "UNANSWERED", 0, null)];
      const en = q.poolEntries!.find((x) => x.id === raw);
      const ok = raw === q.correctEntryId;
      return [part("main", max, ok ? "CORRECT" : "INCORRECT", ok ? max : 0, en?.letter ?? null)];
    }
  }
}

/** One status for the whole question: all parts right = correct, nothing written = unanswered. */
export function questionStatus(parts: PartResult[]): PartStatus {
  if (!parts.length || parts.every((p) => p.status === "UNANSWERED")) return "UNANSWERED";
  if (parts.every((p) => p.status === "CORRECT")) return "CORRECT";
  if (parts.some((p) => p.earned > 0 || p.status === "CORRECT" || p.status === "PARTIAL")) return "PARTIAL";
  return "INCORRECT";
}

/** Human-readable form of a raw answer for the read-only attempt view. */
export function displayAnswer(q: QuestionSnapshot, raw: RawAnswer): string[] {
  if (isBlank(raw)) return [];
  if (q.type === "SINGLE_CHOICE") {
    const o = q.options!.find((x) => x.id === raw);
    return o ? [`${o.letter}. ${o.text}`] : [];
  }
  if (q.type === "MULTIPLE_CHOICE") return q.options!.filter((o) => (raw as string[]).includes(o.id)).map((o) => `${o.letter}. ${o.text}`);
  if (q.type === "MATCHING") {
    const e = q.poolEntries!.find((x) => x.id === raw);
    return e ? [`${e.letter}. ${e.text}`] : [];
  }
  if (q.type === "MULTI_TEXT_INPUT") return (raw as string[]).map((v, i) => `(${i + 1}) ${v?.trim() ? v : "—"}`);
  return [String(raw)];
}

export function displayKey(q: QuestionSnapshot): string[] {
  if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") return q.options!.filter((o) => o.isCorrect).map((o) => `${o.letter}. ${o.text}`);
  if (q.type === "MATCHING") {
    const e = q.poolEntries!.find((x) => x.id === q.correctEntryId);
    return e ? [`${e.letter}. ${e.text}`] : [];
  }
  if (q.type === "MULTI_TEXT_INPUT") return q.blanks!.map((b, i) => `(${i + 1}) ${b.acceptedAnswers.join(" / ")}`);
  if (q.gradingMode === "MANUAL") return ["Giáo viên chấm tay"];
  return [(q.acceptedAnswers ?? []).join(" / ")];
}
