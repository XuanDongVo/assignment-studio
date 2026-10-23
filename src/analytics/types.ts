/**
 * Data that must be stored when a student does an assignment, so it can be analysed later.
 * Everything here is frozen at start / submit time: editing the assignment afterwards never
 * changes a submitted result (each attempt keeps its own copy of the questions).
 * Per-question answer timestamps are intentionally NOT stored (decision: only started/submitted times).
 */
import type { ID, InteractionType } from "@/builder/types";

/** Result of one gradable part (a whole question, or one blank of a multi-blank question). */
export type PartStatus = "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED";

export interface Student {
  id: ID;
  name: string;
  /** Class the student is in today. Used only for students who have not started. */
  classId: string;
}

export interface QuestionPart {
  /** Stable key inside the question: "main", or "blank-1", "blank-2"… */
  key: string;
  label: string;
  max: number;
}

/** Copy of one question as the student saw it, including the answer key (teacher-side only). */
export interface QuestionSnapshot {
  questionId: ID;
  /** null for example items. */
  number: number | null;
  type: InteractionType;
  gradingMode: "AUTO" | "MANUAL";
  /** Markup ([[u]], {{n}}) as written by the teacher. */
  prompt: string;
  sectionId: ID;
  sectionTitle: string;
  /** Shared block the question belongs to (passage title, "Answer pool"…), if any. */
  groupLabel: string | null;
  /** Passage blank number this question answers (cloze), if any. */
  blankRef?: number | null;
  points: number;
  isExample: boolean;
  options?: { id: ID; letter: string; text: string; isCorrect: boolean }[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  blanks?: { key: string; acceptedAnswers: string[] }[];
  poolEntries?: { id: ID; letter: string; text: string }[];
  correctEntryId?: ID | null;
  parts: QuestionPart[];
}

/** Raw answer as typed/chosen: option or entry id, text, list of ids/texts, or null when blank. */
export type RawAnswer = string | string[] | null;

export interface PartResult {
  key: string;
  status: PartStatus;
  earned: number;
  max: number;
  /** Normalised value used for grouping (lower-case, single spaces, no final full stop; letters for choices). */
  normalized: string | null;
  /** Which grader produced this result, so re-grading can be traced. */
  graderVersion: string;
}

export interface ResponseRecord {
  questionId: ID;
  raw: RawAnswer;
  /** Empty while the attempt is still in progress (graded on submit). */
  parts: PartResult[];
}

export interface Attempt {
  id: ID;
  studentId: ID;
  assignmentId: ID;
  /** Class at the moment the attempt started; all analysis of submitted work uses this. */
  classIdAtStart: string;
  startedAt: string;
  /** startedAt + time limit (null when there is no limit). */
  expiresAt: string | null;
  submittedAt: string | null;
  /** Submitted automatically because time ran out. */
  timedOut: boolean;
  /** Frozen when submitting: submittedAt was after the due date. */
  late: boolean;
  scoreEarned: number | null;
  scoreMax: number;
  percent: number | null;
  questions: QuestionSnapshot[];
  responses: ResponseRecord[];
}

export interface ResultsDataset {
  assignmentId: ID;
  /** Moment the data was read; progress states (overdue, in progress) are computed against it. */
  asOf: string;
  startAt: string;
  dueAt: string;
  timeLimitMin: number | null;
  assignedClassIds: string[];
  students: Student[];
  attempts: Attempt[];
  isSample: boolean;
}
