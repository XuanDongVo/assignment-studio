export type ID = string;

export type InteractionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TEXT_INPUT"
  | "MULTI_TEXT_INPUT"
  | "MATCHING";

export interface ChoiceOption {
  id: ID;
  text: string;
  isCorrect: boolean;
}

interface BaseQuestion {
  prompt: string;
  explanation?: string;
  hint?: string;
  /** Number of the passage blank ({{n}}) this question answers, when inside a cloze passage group. */
  blankRef?: number | null;
}

export interface SingleChoiceContent extends BaseQuestion {
  type: "SINGLE_CHOICE";
  options: ChoiceOption[];
  display: "list" | "dropdown";
}
export interface MultipleChoiceContent extends BaseQuestion {
  type: "MULTIPLE_CHOICE";
  options: ChoiceOption[];
}
export interface TextInputContent extends BaseQuestion {
  type: "TEXT_INPUT";
  acceptedAnswers: string[];
  caseSensitive: boolean;
  prefix?: string;
  cue?: string;
}
export interface BlankDef {
  id: ID;
  acceptedAnswers: string[];
}
export interface MultiTextContent extends BaseQuestion {
  type: "MULTI_TEXT_INPUT";
  blanks: BlankDef[];
  caseSensitive: boolean;
}
export interface MatchingContent extends BaseQuestion {
  type: "MATCHING";
  poolId: ID | null;
  correctEntryId: ID | null;
}

export type QuestionContent =
  | SingleChoiceContent
  | MultipleChoiceContent
  | TextInputContent
  | MultiTextContent
  | MatchingContent;

export interface ItemConfig {
  points: number;
  required: boolean;
  gradingMode: "AUTO" | "MANUAL";
  isExample: boolean;
  groupId: ID | null;
}

export interface QuestionItem {
  id: ID;
  kind: "question";
  content: QuestionContent;
  config: ItemConfig;
}

export interface PoolEntry {
  id: ID;
  text: string;
}

export type BlockContent =
  | { type: "INSTRUCTIONS"; text: string }
  | { type: "PASSAGE"; title: string; text: string }
  | { type: "MEDIA"; url: string; alt: string; caption: string }
  | { type: "POOL"; title: string; entries: PoolEntry[] };

export type BlockType = BlockContent["type"];

export interface BlockItem {
  id: ID;
  kind: "block";
  block: BlockContent;
  /** Ordered ids of questions owned by this shared block (their config.groupId === this id). */
  memberIds: ID[];
}

export type Item = QuestionItem | BlockItem;

export interface Section {
  id: ID;
  titleEn: string;
  titleVi: string;
  instructionsEn: string;
  instructionsVi: string;
  itemIds: ID[];
}

export type ShowAnswers = "off" | "after_submission" | "after_due";

export interface AssignmentSettings {
  timeLimitMin: number | null;
  startAt: string;
  dueAt: string;
  classIds: string[];
  showAnswers: ShowAnswers;
  showPoints: boolean;
  shuffle: boolean;
}

export interface Assignment {
  id: ID;
  title: string;
  grade: 6 | 7 | 8;
  instructions: string;
  settings: AssignmentSettings;
  sections: Section[];
  items: Record<ID, Item>;
  updatedAt: string;
}

export type ToolKey =
  | "SINGLE_CHOICE"
  | "TRUE_FALSE"
  | "MULTIPLE_CHOICE"
  | "TEXT_INPUT"
  | "MULTI_BLANKS"
  | "MATCHING"
  | "SECTION"
  | "INSTRUCTIONS"
  | "PASSAGE"
  | "MEDIA"
  | "POOL";

export type Selection = { kind: "item" | "section"; id: ID } | null;

export interface InsertTarget {
  sectionId: ID;
  groupId: ID | null;
  index: number;
}
