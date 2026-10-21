// @ts-nocheck -- prototype: strict index-access checks relaxed
import type { Assignment, BlockItem, Item, ItemConfig, QuestionContent, QuestionItem, Section } from "./types";

export const DEMO_ID = "asg_demo_all_types";

/**
 * Showcase assignment: every question type (single choice, true/false, multiple choice,
 * text input, multiple blanks, matching) and every shared block (instructions, passage,
 * image, answer pool). Deterministic ids so it renders the same everywhere.
 */
export function createDemo(id = DEMO_ID): Assignment {
  let n = 0;
  const nid = (p: string) => `d${p}${++n}`;
  const items: Record<string, Item> = {};
  const cfg = (c: Partial<ItemConfig> = {}): ItemConfig => ({ points: 1, required: true, gradingMode: "AUTO", isExample: false, groupId: null, ...c });
  const q = (content: QuestionContent, c?: Partial<ItemConfig>): string => {
    const it: QuestionItem = { id: nid("q"), kind: "question", content, config: cfg(c) };
    items[it.id] = it;
    return it.id;
  };
  const opts = (texts: string[], correct: number[]) => texts.map((t, i) => ({ id: nid("o"), text: t, isCorrect: correct.includes(i) }));
  const sc = (prompt: string, texts: string[], correct: number, extra: Record<string, unknown> = {}): QuestionContent =>
    ({ type: "SINGLE_CHOICE", prompt, display: "list", options: opts(texts, [correct]), ...extra }) as QuestionContent;
  const tf = (prompt: string, isTrue: boolean): QuestionContent => sc(prompt, ["True", "False"], isTrue ? 0 : 1);
  const mc = (prompt: string, texts: string[], correct: number[]): QuestionContent =>
    ({ type: "MULTIPLE_CHOICE", prompt, options: opts(texts, correct) }) as QuestionContent;
  const ti = (prompt: string, answers: string[], extra: Record<string, unknown> = {}): QuestionContent =>
    ({ type: "TEXT_INPUT", prompt, acceptedAnswers: answers, caseSensitive: false, ...extra }) as QuestionContent;
  const mt = (prompt: string, blanks: string[][]): QuestionContent =>
    ({ type: "MULTI_TEXT_INPUT", prompt, caseSensitive: false, blanks: blanks.map((a) => ({ id: nid("bl"), acceptedAnswers: a })) }) as QuestionContent;
  const block = (b: BlockItem["block"], members: string[]): string => {
    const it: BlockItem = { id: nid("b"), kind: "block", block: b, memberIds: members };
    items[it.id] = it;
    members.forEach((m) => ((items[m] as QuestionItem).config.groupId = it.id));
    return it.id;
  };
  const sec = (titleEn: string, titleVi: string, instructionsEn: string, instructionsVi: string, itemIds: string[]): Section =>
    ({ id: nid("s"), titleEn, titleVi, instructionsEn, instructionsVi, itemIds });

  // 1 — Single choice (list), pronunciation underline, example item, True/False
  const s1 = sec("1. Single choice & True / False", "1. Chọn một đáp án & Đúng / Sai", "Choose the best answer. The first question is an example.", "Chọn đáp án đúng nhất. Câu đầu tiên là ví dụ.", [
    q(sc("I {{1}} a student at Green Valley School.", ["am", "is", "are", "be"], 0), { isExample: true, points: 0 }),
    q(sc("We have Maths {{1}} Monday and Friday.", ["in", "on", "at", "for"], 1)),
    q(sc("", ["c[[a]]t", "h[[a]]t", "m[[a]]p", "n[[a]]me"], 3)),
    q(tf("Ha Noi is the capital city of Viet Nam.", true)),
    q(tf("There are eight days in a week.", false)),
  ]);

  // 2 — Multiple choice (more than one correct)
  const s2 = sec("2. Multiple choice – choose all correct answers", "2. Chọn nhiều đáp án đúng", "There may be more than one correct answer. Tick all that are correct.", "Có thể có nhiều hơn một đáp án đúng. Đánh dấu tất cả đáp án đúng.", [
    q(mc("Which of these are school subjects?", ["Maths", "History", "Football", "Science"], [0, 1, 3])),
    q(mc("Which things can you usually find in a classroom?", ["a board", "a desk", "a fridge", "a bed"], [0, 1])),
  ]);

  // 3 — Text input (blank, cue, prefix), multiple blanks, manual grading
  const s3 = sec("3. Text input & multiple blanks", "3. Điền từ & nhiều chỗ trống", "Write your answers in the blanks.", "Viết câu trả lời vào chỗ trống.", [
    q(ti("Look! The children {{1}} football in the yard.", ["are playing", "'re playing"], { cue: "(play)" })),
    q(ti("Nam likes English best.", ["Nam's favourite subject is English.", "Nam's favourite subject is English"], { prefix: "→ Nam's favourite subject" })),
    q(mt("My brother {{1}} (get) up at six. He {{2}} (have) breakfast and {{3}} (go) to school.", [["gets"], ["has"], ["goes"]]), { points: 1.5 }),
    q(ti("Write two sentences about your best friend.", []), { gradingMode: "MANUAL", points: 2 }),
  ]);

  // 4 — Instructions block owning a group of True/False questions
  const s4 = sec("4. Read the notice", "4. Đọc thông báo", "Read the notice, then decide if each sentence is True or False.", "Đọc thông báo, sau đó cho biết mỗi câu Đúng hay Sai.", [
    block({ type: "INSTRUCTIONS", text: "SCHOOL LIBRARY NOTICE — The library is open from 7:00 a.m. to 4:30 p.m., Monday to Friday. Students can borrow two books for one week. Please keep quiet and do not eat or drink in the library." }, [
      q(tf("The library is open on Saturday.", false)),
      q(tf("Students can borrow two books.", true)),
      q(tf("You can eat in the library.", false)),
    ]),
  ]);

  // 5 — Image block owning questions about the picture
  const s5 = sec("5. Look at the picture", "5. Nhìn tranh", "Look at the classroom picture and answer the questions.", "Nhìn bức tranh lớp học và trả lời câu hỏi.", [
    block({ type: "MEDIA", url: "/demo/classroom.jpg", alt: "A classroom with a green board, a clock above it, a globe on the teacher's desk and a bookshelf", caption: "Our classroom" }, [
      q(tf("There is a clock above the board.", true)),
      q(ti("There is a {{1}} on the teacher's desk.", ["globe"])),
      q(sc("What colour is the board?", ["black", "white", "green", "blue"], 2)),
    ]),
  ]);

  // 6 — Reading passage: comprehension questions
  const s6 = sec("6. Reading comprehension", "6. Đọc hiểu", "Read the passage and answer the questions.", "Đọc đoạn văn và trả lời câu hỏi.", [
    block({ type: "PASSAGE", title: "Mai's New School", text: "Mai is in grade 6 at Green Valley School. Her school is big and it has a beautiful garden. Mai goes to school by bike with her friend Lan. Her favourite subject is Science because she loves doing experiments. At break time, she often reads books in the library." }, [
      q(sc("How does Mai go to school?", ["on foot", "by bus", "by bike", "by car"], 2)),
      q(tf("Mai's favourite subject is Maths.", false)),
      q(ti("Where does Mai often read books at break time?", ["in the library", "the library", "library"])),
    ]),
  ]);

  // 7 — Cloze passage: numbered blanks, dropdowns + one open blank
  const c1 = q(sc("", ["a", "an", "the", "some"], 0, { display: "dropdown", blankRef: 1 }));
  const c2 = q(sc("", ["go", "goes", "going", "went"], 1, { display: "dropdown", blankRef: 2 }));
  const c3 = q(sc("", ["in", "on", "at", "under"], 0, { display: "dropdown", blankRef: 3 }));
  const c4 = q(ti("", ["friends"], { blankRef: 4 }));
  const s7 = sec("7. Cloze passage", "7. Điền vào đoạn văn", "Choose or write the correct word for each numbered blank.", "Chọn hoặc viết từ đúng cho mỗi chỗ trống được đánh số.", [
    block({ type: "PASSAGE", title: "My Weekend", text: "On Saturday, I usually have {{1}} big breakfast with my family. Then my sister {{2}} to her piano class. In the afternoon, I play badminton {{3}} the park near my house. On Sunday, I visit my grandparents or meet my {{4}}." }, [c1, c2, c3, c4]),
  ]);

  // 8 — Answer pool shared by matching items (A–F)
  const pool = ["Yes, I do.", "By bus.", "At 7 o'clock.", "Science.", "My English teacher.", "Twice a week."].map((text) => ({ id: nid("e"), text }));
  const pairs: [string, number, boolean][] = [
    ["Do you like music?", 0, true],
    ["How do you go to school?", 1, false],
    ["What time do your lessons start?", 2, false],
    ["What is your favourite subject?", 3, false],
    ["Who is that woman?", 4, false],
    ["How often do you have PE?", 5, false],
  ];
  const mIds = pairs.map(([p, e, ex]) => q({ type: "MATCHING", prompt: p, poolId: null, correctEntryId: pool[e].id }, ex ? { isExample: true, points: 0 } : {}));
  const poolId = block({ type: "POOL", title: "Answers", entries: pool }, mIds);
  mIds.forEach((m) => (((items[m] as QuestionItem).content as { poolId: string | null }).poolId = poolId));
  const s8 = sec("8. Match the questions with the answers", "8. Nối câu hỏi với câu trả lời", "Choose a letter A–F for each question. Question 0 is an example.", "Chọn chữ cái A–F cho mỗi câu hỏi. Câu 0 là ví dụ.", [poolId]);

  return {
    id,
    title: "Demo · All question types & shared content",
    grade: 6,
    instructions: "This demo shows every question type and every shared content block. Answer all the questions.",
    settings: { timeLimitMin: 40, startAt: "2026-10-22T07:30", dueAt: "2026-10-29T21:00", classIds: ["6A1", "6A2"], showAnswers: "after_submission", showPoints: true, shuffle: false },
    sections: [s1, s2, s3, s4, s5, s6, s7, s8],
    items,
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
}
