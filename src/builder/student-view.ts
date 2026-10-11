// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Student-facing view model. Built from the editor state but deliberately strips
 * isCorrect, acceptedAnswers, explanations and hints so no answer key reaches the DOM.
 * Only example items keep their (public) model answer.
 */
import { computeNumbering, letter } from "./ops";
import type { Assignment, BlockItem, ID, InteractionType, QuestionItem } from "./types";

export interface SQuestion {
  id: ID;
  number: number | null;
  type: InteractionType;
  prompt: string;
  options?: { id: ID; text: string }[];
  display?: "list" | "dropdown";
  prefix?: string;
  cue?: string;
  blankCount: number;
  poolEntries?: { id: ID; letter: string; text: string }[];
  points: number;
  isExample: boolean;
  exampleAnswer?: string;
  blankRef: number | null;
}
export interface SBlock {
  id: ID;
  type: BlockItem["block"]["type"];
  title?: string;
  text?: string;
  alt?: string;
  caption?: string;
  url?: string;
  entries?: { id: ID; letter: string; text: string }[];
}
export type SUnit = { kind: "question"; q: SQuestion } | { kind: "group"; block: SBlock; members: SQuestion[] };
export interface SSection {
  id: ID;
  titleEn: string;
  titleVi: string;
  instructionsEn: string;
  instructionsVi: string;
  units: SUnit[];
}
export interface StudentAssignment {
  title: string;
  grade: number;
  instructions: string;
  timeLimitMin: number | null;
  totalQuestions: number;
  totalPoints: number;
  sections: SSection[];
}

/** Replace {{answer|alt}} tokens by sequential numbers so answers never leak. */
export function sanitizeMarkup(text: string) {
  let i = 0;
  return text.replace(/\{\{(.+?)\}\}/g, (_m, inner: string) => {
    i++;
    return /^\d+$/.test(inner.trim()) ? `{{${inner.trim()}}}` : `{{${i}}}`;
  });
}

function entriesOf(a: Assignment, poolId: ID | null) {
  const p = poolId ? (a.items[poolId] as BlockItem | undefined) : undefined;
  if (!p || p.block.type !== "POOL") return [];
  return p.block.entries.map((e, i) => ({ id: e.id, letter: letter(i), text: e.text }));
}

function toSQ(a: Assignment, q: QuestionItem, number: number | null): SQuestion {
  const c = q.content;
  const base: SQuestion = {
    id: q.id,
    number,
    type: c.type,
    prompt: sanitizeMarkup(c.prompt),
    blankCount: (c.prompt.match(/\{\{.+?\}\}/g) ?? []).length,
    points: q.config.points,
    isExample: q.config.isExample,
    blankRef: c.blankRef ?? null,
  };
  let ex: string | undefined;
  if (c.type === "SINGLE_CHOICE" || c.type === "MULTIPLE_CHOICE") {
    base.options = c.options.map((o) => ({ id: o.id, text: o.text }));
    base.display = c.type === "SINGLE_CHOICE" ? c.display : "list";
    ex = c.options.filter((o) => o.isCorrect).map((o) => o.text).join(", ");
  } else if (c.type === "TEXT_INPUT") {
    base.prefix = c.prefix;
    base.cue = c.cue;
    ex = c.acceptedAnswers[0];
  } else if (c.type === "MULTI_TEXT_INPUT") {
    ex = c.blanks.map((b) => b.acceptedAnswers[0]).join(" / ");
  } else if (c.type === "MATCHING") {
    base.poolEntries = entriesOf(a, c.poolId);
    ex = base.poolEntries.find((e) => e.id === c.correctEntryId)?.letter;
  }
  if (q.config.isExample) base.exampleAnswer = ex;
  return base;
}

export function buildStudentView(a: Assignment): StudentAssignment {
  const { numbers, total, points } = computeNumbering(a);
  const sections: SSection[] = a.sections.map((s) => ({
    id: s.id,
    titleEn: s.titleEn,
    titleVi: s.titleVi,
    instructionsEn: s.instructionsEn,
    instructionsVi: s.instructionsVi,
    units: s.itemIds
      .map((id): SUnit | null => {
        const it = a.items[id];
        if (!it) return null;
        if (it.kind === "question") return { kind: "question", q: toSQ(a, it, numbers.get(id) ?? null) };
        const b = it.block;
        const block: SBlock = { id: it.id, type: b.type };
        if (b.type === "PASSAGE") Object.assign(block, { title: b.title, text: sanitizeMarkup(b.text) });
        if (b.type === "INSTRUCTIONS") block.text = b.text;
        if (b.type === "MEDIA") Object.assign(block, { url: b.url, alt: b.alt, caption: b.caption });
        if (b.type === "POOL") Object.assign(block, { title: b.title, entries: entriesOf(a, it.id) });
        const members = it.memberIds
          .map((m) => a.items[m])
          .filter((m): m is QuestionItem => m?.kind === "question")
          .map((m) => toSQ(a, m, numbers.get(m.id) ?? null));
        return { kind: "group", block, members };
      })
      .filter((u): u is SUnit => !!u),
  }));
  return { title: a.title, grade: a.grade, instructions: a.instructions, timeLimitMin: a.settings.timeLimitMin, totalQuestions: total, totalPoints: points, sections };
}
