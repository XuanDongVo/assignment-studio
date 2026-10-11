import type { Assignment, BlockItem, Item, ItemConfig, QuestionContent, QuestionItem, Section } from "./types";

/** Deterministic ids so server and client render the same seed. */
export function createSeed(id = "asg_grade6_unit1"): Assignment {
  let n = 0;
  const nid = (p: string) => `${p}${++n}`;
  const items: Record<string, Item> = {};
  const cfg = (c: Partial<ItemConfig> = {}): ItemConfig => ({ points: 0.25, required: true, gradingMode: "AUTO", isExample: false, groupId: null, ...c });
  const q = (content: QuestionContent, c?: Partial<ItemConfig>): string => {
    const it: QuestionItem = { id: nid("q"), kind: "question", content, config: cfg(c) };
    items[it.id] = it;
    return it.id;
  };
  const sc = (prompt: string, opts: string[], correct: number, extra: Partial<QuestionContent> = {}): QuestionContent =>
    ({ type: "SINGLE_CHOICE", prompt, display: "list", options: opts.map((t, i) => ({ id: nid("o"), text: t, isCorrect: i === correct })), ...extra }) as QuestionContent;
  const ti = (prompt: string, answers: string[], extra: Record<string, unknown> = {}): QuestionContent =>
    ({ type: "TEXT_INPUT", prompt, acceptedAnswers: answers, caseSensitive: false, ...extra }) as QuestionContent;
  const block = (b: BlockItem["block"], members: string[]): string => {
    const it: BlockItem = { id: nid("b"), kind: "block", block: b, memberIds: members };
    items[it.id] = it;
    members.forEach((m) => ((items[m] as QuestionItem).config.groupId = it.id));
    return it.id;
  };
  const sec = (titleEn: string, titleVi: string, instructionsEn: string, instructionsVi: string, itemIds: string[]): Section => ({ id: nid("s"), titleEn, titleVi, instructionsEn, instructionsVi, itemIds });

  // I
  const s1 = sec("I. Pronunciation", "I. Ngữ âm", "Choose the word whose underlined part is pronounced differently from the others.", "Chọn từ có phần gạch chân được phát âm khác với các từ còn lại.", [
    q(sc("", ["h[[ea]]d", "br[[ea]]d", "m[[ea]]t", "w[[ea]]ther"], 2)),
    q(sc("", ["b[[oo]]k", "l[[oo]]k", "f[[oo]]d", "g[[oo]]d"], 2)),
    q(sc("", ["c[[i]]ty", "l[[i]]ke", "n[[i]]ce", "t[[i]]me"], 0)),
    q(sc("", ["s[[ch]]ool", "[[ch]]air", "tea[[ch]]er", "lun[[ch]]"], 0)),
  ]);

  // II
  const s2 = sec("II. Look at the pictures and complete the sentences", "II. Nhìn tranh và hoàn thành câu", "Write one word under each picture to complete the sentence.", "Viết một từ để hoàn thành câu theo bức tranh.", [
    block({ type: "MEDIA", url: "", alt: "A dictionary", caption: "Picture 1" }, [q(ti("You can use a {{1}} to look up a new word.", ["dictionary"]))]),
    block({ type: "MEDIA", url: "", alt: "A ruler", caption: "Picture 2" }, [q(ti("We use a {{1}} to draw straight lines.", ["ruler"]))]),
    block({ type: "MEDIA", url: "", alt: "", caption: "Picture 3" }, [q(ti("I keep my pens and pencils in a {{1}}.", ["pencil case", "pencil-case"]))]),
  ]);

  // III
  const s3 = sec("III. Choose the best answer", "III. Chọn đáp án đúng nhất", "Choose A, B, C or D to complete each sentence.", "Chọn A, B, C hoặc D để hoàn thành câu.", [
    q(sc("How is your first week {{1}} school?", ["at", "in", "on", "for"], 0)),
    q(sc("My brother often {{1}} judo after school.", ["do", "does", "play", "plays"], 1)),
    q(sc("{{1}} you have a new compass?", ["Do", "Does", "Are", "Is"], 0)),
    q(sc("Mai and her friends {{1}} their homework now.", ["do", "does", "are doing", "is doing"], 2)),
  ]);

  // IV
  const s4 = sec("IV. Give the correct form of the verbs", "IV. Chia dạng đúng của động từ", "Write the correct form of the verbs in brackets.", "Viết dạng đúng của động từ trong ngoặc.", [
    q(ti("Look! The cat {{1}} (eat) your breakfast.", ["is eating", "'s eating"])),
    q(ti("My father usually {{1}} (go) to work by bus.", ["goes"])),
    q({ type: "MULTI_TEXT_INPUT", prompt: "{{1}} your sister {{2}} (like) English?", caseSensitive: false, blanks: [{ id: nid("bl"), acceptedAnswers: ["Does"] }, { id: nid("bl"), acceptedAnswers: ["like"] }] }, { points: 0.5 }),
    q({ type: "MULTI_TEXT_INPUT", prompt: "We {{1}} (not watch) TV now. We {{2}} (do) our homework.", caseSensitive: false, blanks: [{ id: nid("bl"), acceptedAnswers: ["aren't watching", "are not watching"] }, { id: nid("bl"), acceptedAnswers: ["are doing", "'re doing"] }] }, { points: 0.5 }),
  ]);

  // V
  const s5 = sec("V. Find and correct the mistake", "V. Tìm và sửa lỗi sai", "Each sentence has one mistake. Write the mistake and its correction.", "Mỗi câu có một lỗi sai. Viết lỗi sai và sửa lại.", [
    q(ti("He go to school every day.", ["go → goes"], { prefix: "→" }), { isExample: true, points: 0 }),
    q(ti("She is wanting to buy a new computer.", ["is wanting → wants", "wants"], { prefix: "→" })),
    q(ti("There is many books on the shelf.", ["is → are", "are"], { prefix: "→" })),
    q(ti("My sister don't like milk.", ["don't → doesn't", "doesn't"], { prefix: "→" })),
  ]);

  // VI
  const pool = ["No, they are sleeping.", "By bicycle.", "To buy some bread.", "My friends.", "Five days a week.", "Home.", "Yes, I do.", "I go out and play in the playground."].map((text) => ({ id: nid("e"), text }));
  const matchQs: [string, number][] = [
    ["Who are you waiting for?", 3],
    ["How do you go to school?", 1],
    ["Why do you go to the bakery?", 2],
    ["Are the children playing in the garden?", 0],
    ["How often do you have English?", 4],
    ["Where are you going after class?", 5],
    ["Do you like Maths?", 6],
    ["What do you do at break time?", 7],
  ];
  const mIds = matchQs.map(([p, e]) => q({ type: "MATCHING", prompt: p, poolId: null, correctEntryId: pool[e].id }));
  const poolId = block({ type: "POOL", title: "Answers", entries: pool }, mIds);
  mIds.forEach((m) => ((items[m] as QuestionItem).content as { poolId: string | null }).poolId = poolId);
  const s6 = sec("VI. Match the questions with the answers", "VI. Nối câu hỏi với câu trả lời", "Choose the letter A–H for each question.", "Chọn chữ cái A–H cho mỗi câu hỏi.", [poolId]);

  // VII
  const cloze: [string[], number][] = [
    [["building", "house", "park", "market"], 0],
    [["classrooms", "kitchens", "bedrooms", "shops"], 0],
    [["playground", "bathroom", "canteen", "lab"], 0],
    [["floor", "door", "wall", "roof"], 0],
    [["line up", "lines up", "lining up", "to line up"], 0],
    [["because", "but", "so", "or"], 0],
  ];
  const cIds = cloze.map(([o, c], i) => q(sc("", o, c, { display: "dropdown", blankRef: i + 1 } as Partial<QuestionContent>)));
  const s7 = sec("VII. Read and choose the correct word for each blank", "VII. Đọc và chọn từ đúng cho mỗi chỗ trống", "Read the passage and choose the best word for each numbered blank.", "Đọc đoạn văn và chọn từ đúng nhất cho mỗi chỗ trống.", [
    block({ type: "PASSAGE", title: "School Building", text: "My school is in the centre of the town. It is a big {{1}} with three floors. There are twenty {{2}} and a large library. Our school has a big {{3}} where we play football at break time. The computer room is on the second {{4}}. Every morning, the students {{5}} in the yard before class. I love my school {{6}} my teachers are very kind and friendly." }, cIds),
  ]);

  // VIII
  const s8 = sec("VIII. Write complete sentences using the cues", "VIII. Viết câu hoàn chỉnh từ gợi ý", "Use the words given to write complete sentences.", "Dùng từ gợi ý để viết câu hoàn chỉnh.", [
    q(ti("I / usually / ride / bike / school.", ["I usually ride my bike to school."]), { gradingMode: "MANUAL", points: 0.5 }),
    q(ti("My best friend / have / long black hair / big eyes.", ["My best friend has long black hair and big eyes."]), { gradingMode: "MANUAL", points: 0.5 }),
    q(ti("There / be / thirty-five students / my class.", ["There are thirty-five students in my class."]), { gradingMode: "MANUAL", points: 0.5 }),
  ]);

  // IX
  const s9 = sec("IX. Rewrite the sentences", "IX. Viết lại câu", "Rewrite each sentence so that it means the same as the first one.", "Viết lại câu sao cho nghĩa không đổi.", [
    q(ti("What is your favourite subject?", ["What subject do you like best?", "What subject do you like the best?"], { prefix: "→ What subject" }), { points: 0.5 }),
    q(ti("There are 35 students in my class.", ["My class has 35 students."], { prefix: "→ My class" }), { points: 0.5 }),
    q(ti("Nam is reading a book. He isn't listening to music.", ["Nam is not listening to music.", "Nam isn't listening to music."], { prefix: "→ Nam", cue: "(not listen)" }), { points: 0.5 }),
  ]);

  return {
    id,
    title: "Unit 1 – My New School · Review Test",
    grade: 6,
    instructions: "Answer all the questions. Read each section's instructions carefully before you begin.",
    settings: { timeLimitMin: 45, startAt: "2026-10-12T07:30", dueAt: "2026-10-19T21:00", classIds: ["6A1"], showAnswers: "after_due", showPoints: true, shuffle: false },
    sections: [s1, s2, s3, s4, s5, s6, s7, s8, s9],
    items,
    updatedAt: "2026-10-10T08:00:00.000Z",
  };
}

export const MOCK_CLASSES = ["6A1", "6A2", "6A3", "6A4", "7A1", "7A2", "8A1"];
