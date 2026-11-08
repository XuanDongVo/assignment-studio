import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GripVertical,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Unlink,
  Wand2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as ops from "../ops";
import {
  addPracticeItem,
  createPractice,
  generatePracticeBlanks,
  GUIDE_BLOCK,
  poolUsers,
  type GuideScenario,
} from "../shared-guide";
import type { Assignment, BlockItem, BlockType, ToolKey } from "../types";
import { RichText } from "./RichText";

const SCENARIOS: { id: GuideScenario; label: string }[] = [
  { id: "cloze", label: "Cloze Passage" },
  { id: "pool", label: "Pool + Matching" },
  { id: "media", label: "Image / Media" },
  { id: "instructions", label: "Instructions" },
  { id: "groups", label: "Quản lý nhóm" },
];
const LESSONS: Record<GuideScenario, string[]> = {
  cloze: [
    "Kéo Reading passage từ cột trái vào Section, hoặc bấm thẻ để thêm.",
    "Gõ bài đọc có {{1}} và {{2}}. Các số trở thành chip chỗ trống.",
    "Bấm Create questions for all blanks: mỗi chip tạo một câu Text input trong nhóm.",
    "Bấm chip số rồi nhập đáp án ở cột thuộc tính. Có thể đổi sang Single choice ở trình soạn thật.",
  ],
  pool: [
    "Kéo Answer pool vào Section.",
    "Nhập các lựa chọn A–H. Chữ cái tự đánh, liên kết được giữ bằng ID.",
    "Kéo Matching vào khung pool hoặc bấm + Add question to this group.",
    "Chọn câu hỏi rồi chọn chữ cái đáp án. Thử xóa lựa chọn đang dùng để thấy cảnh báo.",
  ],
  media: [
    "Kéo Image vào Section.",
    "Bấm Dùng ảnh mẫu hoặc nhập đường dẫn ảnh, mô tả và chú thích.",
    "Thêm Single choice, Text input hoặc Multiple blanks vào khung ảnh.",
    "Chọn từng câu để nhập đề và đáp án; học sinh chỉ thấy ảnh một lần cho cả nhóm.",
  ],
  instructions: [
    "Kéo Instructions vào Section.",
    "Nhập chỉ dẫn chung, ví dụ Read and answer the questions below.",
    "Kéo hoặc thêm câu hỏi vào nhóm Instructions.",
    "Chọn câu để sửa. Chỉ dẫn xuất hiện một lần trước tất cả câu trong nhóm.",
  ],
  groups: [
    "Kéo Reading passage vào Section để tạo khối dùng chung.",
    "Nhập nội dung chung cho nhóm.",
    "Thêm hai câu vào nhóm và một câu độc lập trong Section.",
    "Kéo tay cầm cả nhóm sang Section II; thử Attach / Detach ở cột thuộc tính, rồi xóa nhóm để chọn xóa cả nhóm hoặc rã nhóm.",
  ],
};
export const openSharedGuide = (block?: BlockType) =>
  window.dispatchEvent(new CustomEvent("ab:shared-guide", { detail: block }));

function DragTool({ tool, label, onAdd }: { tool: ToolKey; label: string; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guide-tool:${tool}`,
  });
  return (
    <Button
      ref={setNodeRef}
      data-guide-tool={tool}
      {...attributes}
      {...listeners}
      variant="outline"
      className={cn(
        "h-auto w-full touch-none justify-start whitespace-normal py-3 text-left",
        isDragging && "opacity-40",
      )}
      onClick={onAdd}
    >
      <GripVertical className="h-4 w-4 shrink-0" />
      {label}
    </Button>
  );
}
function DropZone({ id, children, active }: { id: string; children: ReactNode; active?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-guide-zone={id}
      className={cn(
        "min-h-24 rounded-md border border-dashed p-3",
        (active || isOver) && "guide-spotlight border-primary bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}
function GroupHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `guide-group:${id}` });
  return (
    <Button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      aria-label="Kéo cả nhóm"
      title="Kéo cả nhóm sang Section II"
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  );
}
const field =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function SharedContentGuide() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<GuideScenario>("cloze");
  const [step, setStep] = useState(0);
  const [practice, setPractice] = useState<Assignment>(createPractice);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<{ type: "group" | "entry"; id: string } | null>(null);
  const [animation, setAnimation] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const reset = (id: GuideScenario) => {
    setScenario(id);
    setPractice(createPractice());
    setStep(0);
    setSelected(null);
    setNotice("");
    setConfirm(null);
    setAnimation(false);
  };
  useEffect(() => {
    const start = (e: Event) => {
      const type = (e as CustomEvent<BlockType>).detail;
      reset(
        type === "POOL"
          ? "pool"
          : type === "MEDIA"
            ? "media"
            : type === "INSTRUCTIONS"
              ? "instructions"
              : "cloze",
      );
      setOpen(true);
    };
    window.addEventListener("ab:shared-guide", start);
    return () => window.removeEventListener("ab:shared-guide", start);
  }, []);
  const edit = (fn: (a: Assignment) => void) =>
    setPractice((a) => {
      const next = structuredClone(a);
      fn(next);
      return next;
    });
  const block = Object.values(practice.items).find((i): i is BlockItem => i.kind === "block");
  const q = selected ? practice.items[selected] : null;
  const questionTool: ToolKey =
    scenario === "pool" ? "MATCHING" : scenario === "media" ? "SINGLE_CHOICE" : "TEXT_INPUT";
  const add = (tool: ToolKey, groupId: string | null = null) => {
    edit((a) => {
      const id = addPracticeItem(a, tool, groupId);
      setSelected(id);
    });
    setNotice("Đã thêm vào khu thực hành");
  };
  const ready =
    step === 0
      ? !!block
      : step === 1
        ? !!block &&
          (block.block.type === "PASSAGE"
            ? scenario === "cloze"
              ? ops.blankNumbers(block.block.text).includes(1) &&
                ops.blankNumbers(block.block.text).includes(2)
              : !!block.block.text.trim()
            : block.block.type === "POOL"
              ? block.block.entries.length === 8 && block.block.entries.every((e) => e.text.trim())
              : block.block.type === "MEDIA"
                ? !!block.block.url && !!block.block.alt
                : !!block.block.text.trim())
        : step === 2
          ? (block?.memberIds.length ?? 0) >=
              (scenario === "cloze" || scenario === "groups" ? 2 : 1) &&
            (scenario !== "groups" ||
              practice.sections.some((s) =>
                s.itemIds.some((id) => practice.items[id]?.kind === "question"),
              ))
          : true;
  const updateBlock = (fn: (b: BlockItem) => void) =>
    block &&
    edit((a) => {
      const b = a.items[block.id];
      if (b?.kind === "block") fn(b);
    });
  const questionList = (ids: string[]) =>
    ids.map((id) => {
      const item = practice.items[id];
      if (item?.kind !== "question") return null;
      return (
        <Button
          key={id}
          variant="outline"
          className={cn(
            "my-1 h-auto w-full justify-start whitespace-normal py-3 text-left",
            selected === id && "border-primary bg-primary/5",
          )}
          onClick={() => setSelected(id)}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>
            {item.content.blankRef
              ? `Blank (${item.content.blankRef})`
              : ops.TYPE_LABEL[item.content.type]}{" "}
            · {item.content.prompt || "Chưa nhập đề"}
          </span>
        </Button>
      );
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="shrink-0 border-b p-4 pr-12 text-left">
          <DialogTitle>Thực hành Shared Content</DialogTitle>
          <DialogDescription>
            Mẫu riêng biệt — không lưu hay thay đổi bài đang soạn.
          </DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap gap-2 border-b p-3">
          {SCENARIOS.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={scenario === s.id ? "default" : "outline"}
              onClick={() => reset(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-primary/5 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
            {step + 1}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">{LESSONS[scenario][step]}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAnimation(false);
              requestAnimationFrame(() => setAnimation(true));
            }}
          >
            <Play className="h-4 w-4" /> Xem kéo mẫu
          </Button>
        </div>
        <DndContext
          sensors={sensors}
          onDragEnd={(e) => {
            if (!e.over) return;
            const id = String(e.active.id),
              target = String(e.over.id);
            if (id.startsWith("guide-tool:")) {
              const tool = id.slice(11) as ToolKey;
              if (ops.isBlockTool(tool) && block) return;
              add(
                tool,
                target === "guide-drop-group" && block && ops.isQuestionTool(tool)
                  ? block.id
                  : null,
              );
            }
            if (id.startsWith("guide-group:") && target === "guide-drop-second") {
              edit((a) =>
                ops.moveTo(a, id.slice(12), {
                  sectionId: "practice-section-2",
                  groupId: null,
                  index: 0,
                }),
              );
              setNotice("Đã di chuyển cả nhóm và mọi câu con sang Section II.");
            }
          }}
        >
          <div className="relative grid min-h-0 gap-4 p-4 lg:grid-cols-[12rem_minmax(0,1fr)_16rem]">
            {animation && (
              <div
                aria-hidden
                className="guide-drag-demo pointer-events-none absolute left-4 top-6 z-20 flex items-center gap-2 rounded-md border border-primary bg-card px-3 py-2 text-sm font-semibold text-primary"
              >
                <MousePointer2 className="h-5 w-5" />
                {step < 2 ? ops.TYPE_LABEL[GUIDE_BLOCK[scenario]] : ops.TYPE_LABEL[questionTool]}
              </div>
            )}
            <aside className={cn("space-y-3", step === 0 && "guide-spotlight")}>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Add content</h3>
              <DragTool
                tool={GUIDE_BLOCK[scenario]}
                label={ops.TYPE_LABEL[GUIDE_BLOCK[scenario]] ?? "Shared content"}
                onAdd={() => !block && add(GUIDE_BLOCK[scenario])}
              />
              <DragTool
                tool={questionTool}
                label={ops.TYPE_LABEL[questionTool] ?? "Question"}
                onAdd={() => add(questionTool, block?.id ?? null)}
              />
              {scenario === "media" && (
                <>
                  <DragTool
                    tool="TEXT_INPUT"
                    label="Text input"
                    onAdd={() => add("TEXT_INPUT", block?.id ?? null)}
                  />
                  <DragTool
                    tool="MULTI_BLANKS"
                    label="Multiple blanks"
                    onAdd={() => add("MULTI_BLANKS", block?.id ?? null)}
                  />
                </>
              )}
              {scenario === "groups" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full whitespace-normal"
                  onClick={() => add("TEXT_INPUT")}
                >
                  <Plus className="h-4 w-4" /> Câu độc lập
                </Button>
              )}
            </aside>
            <main className="min-w-0 space-y-4">
              <h3 className="font-semibold">Section I · Khu thực hành</h3>
              <DropZone id="guide-drop-section" active={step === 0}>
                {!block && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Thả {ops.TYPE_LABEL[GUIDE_BLOCK[scenario]]} vào đây
                  </div>
                )}
                {block && practice.sections[0]?.itemIds.includes(block.id) && renderBlock()}
                {questionList(
                  practice.sections[0]?.itemIds.filter(
                    (id) => practice.items[id]?.kind === "question",
                  ) ?? [],
                )}
              </DropZone>
              {scenario === "groups" && (
                <>
                  <h3 className="font-semibold">Section II</h3>
                  <DropZone id="guide-drop-second" active={step === 3}>
                    {block && practice.sections[1]?.itemIds.includes(block.id) ? (
                      renderBlock()
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">
                        Thả tay cầm cả nhóm vào đây
                      </p>
                    )}
                  </DropZone>
                </>
              )}
            </main>
            <aside
              className={cn(
                "min-w-0 space-y-3 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0",
                step === 3 && "guide-spotlight",
              )}
            >
              <h3 className="font-semibold">Thuộc tính câu hỏi</h3>
              {q?.kind === "question" ? (
                <>
                  <label className="block text-xs font-medium">
                    Đề bài
                    <textarea
                      className={cn(field, "mt-1")}
                      aria-label="Đề bài thực hành"
                      value={q.content.prompt}
                      onChange={(e) =>
                        edit((a) => {
                          const item = a.items[q.id];
                          if (item?.kind === "question") item.content.prompt = e.target.value;
                        })
                      }
                    />
                  </label>
                  {q.content.type === "TEXT_INPUT" && (
                    <label className="block text-xs font-medium">
                      Đáp án chấp nhận
                      <input
                        className={cn(field, "mt-1")}
                        aria-label="Đáp án thực hành"
                        value={q.content.acceptedAnswers.join(" / ")}
                        onChange={(e) =>
                          edit((a) => {
                            const item = a.items[q.id];
                            if (item?.kind === "question" && item.content.type === "TEXT_INPUT")
                              item.content.acceptedAnswers = e.target.value
                                .split("/")
                                .map((s) => s.trim());
                          })
                        }
                      />
                    </label>
                  )}
                  {q.content.type === "MATCHING" && block?.block.type === "POOL" && (
                    <label className="block text-xs font-medium">
                      Chữ cái đáp án
                      <select
                        className={cn(field, "mt-1")}
                        aria-label="Chữ cái đáp án"
                        value={q.content.correctEntryId ?? ""}
                        onChange={(e) =>
                          edit((a) => {
                            const item = a.items[q.id];
                            if (item?.kind === "question" && item.content.type === "MATCHING")
                              item.content.correctEntryId = e.target.value || null;
                          })
                        }
                      >
                        <option value="">Chọn đáp án</option>
                        {block.block.entries.map((en, i) => (
                          <option key={en.id} value={en.id}>
                            {ops.letter(i)}. {en.text}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(q.content.type === "SINGLE_CHOICE" || q.content.type === "MULTIPLE_CHOICE") &&
                    q.content.options.map((o, i) => (
                      <label key={o.id} className="flex items-center gap-2 text-xs">
                        <input
                          type={q.content.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                          name={q.id}
                          aria-label={`Đáp án đúng ${ops.letter(i)}`}
                          checked={o.isCorrect}
                          onChange={() =>
                            edit((a) => {
                              const item = a.items[q.id];
                              if (item?.kind === "question" && "options" in item.content)
                                item.content.options.forEach((en) => {
                                  en.isCorrect =
                                    item.content.type === "MULTIPLE_CHOICE"
                                      ? en.id === o.id
                                        ? !en.isCorrect
                                        : en.isCorrect
                                      : en.id === o.id;
                                });
                            })
                          }
                        />
                        <input
                          aria-label={`Lựa chọn ${ops.letter(i)}`}
                          className={field}
                          placeholder={ops.letter(i)}
                          value={o.text}
                          onChange={(e) =>
                            edit((a) => {
                              const item = a.items[q.id];
                              if (item?.kind === "question" && "options" in item.content) {
                                const en = item.content.options.find((x) => x.id === o.id);
                                if (en) en.text = e.target.value;
                              }
                            })
                          }
                        />
                      </label>
                    ))}
                  {q.content.type === "MULTI_TEXT_INPUT" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          edit((a) => {
                            const item = a.items[q.id];
                            if (
                              item?.kind === "question" &&
                              item.content.type === "MULTI_TEXT_INPUT"
                            ) {
                              item.content.blanks.push({
                                id: ops.uid("blank"),
                                acceptedAnswers: [""],
                              });
                              item.content.prompt += ` {{${item.content.blanks.length}}}`;
                            }
                          })
                        }
                      >
                        <Plus className="h-4 w-4" /> Thêm chỗ trống
                      </Button>
                      {q.content.blanks.map((bl, i) => (
                        <input
                          key={bl.id}
                          className={field}
                          aria-label={`Đáp án chỗ trống ${i + 1}`}
                          placeholder={`Đáp án (${i + 1})`}
                          value={bl.acceptedAnswers.join(" / ")}
                          onChange={(e) =>
                            edit((a) => {
                              const item = a.items[q.id];
                              if (
                                item?.kind === "question" &&
                                item.content.type === "MULTI_TEXT_INPUT"
                              ) {
                                const blank = item.content.blanks.find((x) => x.id === bl.id);
                                if (blank) blank.acceptedAnswers = e.target.value.split("/");
                              }
                            })
                          }
                        />
                      ))}
                    </>
                  )}
                  {scenario === "groups" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const loc = ops.locate(practice, q.id);
                        if (!loc || !block) return;
                        edit((a) =>
                          ops.moveTo(a, q.id, {
                            sectionId: ops.locate(a, block.id)?.sectionId ?? loc.sectionId,
                            groupId: loc.groupId ? null : block.id,
                            index: loc.groupId
                              ? (a.sections.find((s) => s.id === loc.sectionId)?.itemIds.length ??
                                0)
                              : block.memberIds.length,
                          }),
                        );
                      }}
                    >
                      <Unlink className="h-4 w-4" />
                      {q.config.groupId ? "Detach · Tách nhóm" : "Attach · Gắn vào nhóm"}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Chọn chip hoặc câu trong nhóm.</p>
              )}
            </aside>
          </div>
        </DndContext>
        {confirm && (
          <div
            role="alertdialog"
            aria-label="Xác nhận xóa thực hành"
            className="mx-4 mb-3 rounded-md border border-warning/40 bg-warning/10 p-3"
          >
            <p className="text-sm font-medium">
              {confirm.type === "entry"
                ? "Lựa chọn này đang là đáp án của câu Matching. Xóa sẽ bỏ liên kết đáp án của câu đó."
                : "Bạn muốn xóa cả nhóm hay chỉ rã nhóm và giữ các câu?"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>
                Hủy
              </Button>
              {confirm.type === "group" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    edit((a) => ops.removeItem(a, confirm.id, false));
                    setConfirm(null);
                    setSelected(null);
                    setNotice("Đã rã nhóm, giữ nguyên các câu độc lập.");
                  }}
                >
                  Chỉ rã nhóm
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  edit((a) => {
                    if (confirm.type === "group") ops.removeItem(a, confirm.id, true);
                    else if (block) {
                      for (const user of poolUsers(a, block.id, confirm.id))
                        if (user.content.type === "MATCHING") user.content.correctEntryId = null;
                      const b = a.items[block.id];
                      if (b?.kind === "block" && b.block.type === "POOL")
                        b.block.entries = b.block.entries.filter((en) => en.id !== confirm.id);
                    }
                  });
                  setConfirm(null);
                  setNotice("Đã xóa trong khu thực hành.");
                }}
              >
                {confirm.type === "group" ? "Xóa cả nhóm" : "Vẫn xóa lựa chọn"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4">
          <p role="status" className="min-w-0 text-xs text-success">
            {notice}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => reset(scenario)}>
              <RotateCcw className="h-4 w-4" /> Làm lại
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={step === 0}
              onClick={() => {
                setStep(step - 1);
                setAnimation(false);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Trước
            </Button>
            {step < 3 ? (
              <Button
                size="sm"
                disabled={!ready}
                onClick={() => {
                  setStep(step + 1);
                  setAnimation(false);
                }}
              >
                <ArrowRight className="h-4 w-4" />
                Tiếp theo
              </Button>
            ) : (
              <Button size="sm" onClick={() => setOpen(false)}>
                <CheckCircle2 className="h-4 w-4" />
                Hoàn tất
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  function renderBlock() {
    if (!block) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GroupHandle id={block.id} />
          <span className="flex-1 text-sm font-semibold">
            {ops.TYPE_LABEL[block.block.type]} · {block.memberIds.length} câu
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Xóa nhóm thực hành"
            onClick={() => setConfirm({ type: "group", id: block.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className={cn("space-y-3", step === 1 && "guide-spotlight")}>
          {block.block.type === "PASSAGE" && (
            <>
              <textarea
                className={field}
                aria-label="Nội dung passage"
                placeholder="My school has {{1}} floors and a big {{2}}."
                value={block.block.text}
                onChange={(e) =>
                  updateBlock((b) => {
                    if (b.block.type === "PASSAGE") b.block.text = e.target.value;
                  })
                }
              />
              <div className="text-sm leading-8">
                <RichText
                  text={block.block.text}
                  renderBlank={(n) => (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mx-1 h-7 text-primary"
                      onClick={() => {
                        const id = block.memberIds.find((id) => {
                          const item = practice.items[id];
                          return item?.kind === "question" && item.content.blankRef === n;
                        });
                        if (id) setSelected(id);
                        else
                          setNotice(
                            "Bấm Create questions for all blanks trước để tạo câu cho chip.",
                          );
                      }}
                    >
                      ({n})
                    </Button>
                  )}
                />
              </div>
              {scenario === "cloze" && (
                <Button
                  size="sm"
                  variant="outline"
                  className={step === 2 ? "guide-spotlight" : ""}
                  onClick={() => edit((a) => generatePracticeBlanks(a, block.id))}
                >
                  <Wand2 className="h-4 w-4" />
                  Create questions for all blanks
                </Button>
              )}
            </>
          )}
          {block.block.type === "POOL" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateBlock((b) => {
                    if (b.block.type === "POOL")
                      b.block.entries = [
                        "No, they are sleeping.",
                        "By bicycle.",
                        "To buy some bread.",
                        "My friends.",
                        "Five days a week.",
                        "Home.",
                        "Yes, I do.",
                        "I go out and play in the playground.",
                      ].map((text) => ({ id: ops.uid("e"), text }));
                  })
                }
              >
                Dùng pool mẫu A–H
              </Button>
              {block.block.entries.map((en, i) => (
                <div key={en.id} className="flex items-center gap-2">
                  <span className="w-4 text-xs font-semibold text-primary">{ops.letter(i)}.</span>
                  <input
                    aria-label={`Pool ${ops.letter(i)}`}
                    className={field}
                    value={en.text}
                    onChange={(e) =>
                      updateBlock((b) => {
                        if (b.block.type === "POOL") {
                          const entry = b.block.entries.find((x) => x.id === en.id);
                          if (entry) entry.text = e.target.value;
                        }
                      })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Xóa pool ${ops.letter(i)}`}
                    onClick={() => {
                      if (poolUsers(practice, block.id, en.id).length)
                        setConfirm({ type: "entry", id: en.id });
                      else
                        updateBlock((b) => {
                          if (b.block.type === "POOL")
                            b.block.entries = b.block.entries.filter((x) => x.id !== en.id);
                        });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateBlock((b) => {
                    if (b.block.type === "POOL")
                      b.block.entries.push({ id: ops.uid("e"), text: "" });
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Thêm lựa chọn
              </Button>
            </>
          )}
          {block.block.type === "MEDIA" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateBlock((b) => {
                    if (b.block.type === "MEDIA") {
                      b.block.url = "/demo/classroom.jpg";
                      b.block.alt = "Students in an English classroom";
                      b.block.caption = "Look at the picture and answer the questions.";
                    }
                  })
                }
              >
                Dùng ảnh mẫu
              </Button>
              <input
                className={field}
                aria-label="Đường dẫn ảnh"
                placeholder="Đường dẫn ảnh"
                value={block.block.url}
                onChange={(e) =>
                  updateBlock((b) => {
                    if (b.block.type === "MEDIA") b.block.url = e.target.value;
                  })
                }
              />
              <input
                className={field}
                aria-label="Mô tả ảnh"
                placeholder="Mô tả ảnh"
                value={block.block.alt}
                onChange={(e) =>
                  updateBlock((b) => {
                    if (b.block.type === "MEDIA") b.block.alt = e.target.value;
                  })
                }
              />
              <input
                className={field}
                aria-label="Chú thích ảnh"
                placeholder="Chú thích ảnh"
                value={block.block.caption}
                onChange={(e) =>
                  updateBlock((b) => {
                    if (b.block.type === "MEDIA") b.block.caption = e.target.value;
                  })
                }
              />
              {block.block.url && (
                <img
                  src={block.block.url}
                  alt={block.block.alt}
                  className="max-h-48 w-full object-contain"
                />
              )}
            </>
          )}
          {block.block.type === "INSTRUCTIONS" && (
            <textarea
              aria-label="Nội dung instructions"
              className={field}
              placeholder="Read and answer the questions below."
              value={block.block.text}
              onChange={(e) =>
                updateBlock((b) => {
                  if (b.block.type === "INSTRUCTIONS") b.block.text = e.target.value;
                })
              }
            />
          )}
        </div>
        <DropZone id="guide-drop-group" active={step === 2}>
          {questionList(block.memberIds)}
          <Button
            size="sm"
            variant="ghost"
            className="h-auto whitespace-normal text-primary"
            onClick={() => add(questionTool, block.id)}
          >
            <Plus className="h-4 w-4" />
            Add question to this group
          </Button>
        </DropZone>
        {scenario === "groups" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              edit((a) =>
                ops.moveTo(a, block.id, {
                  sectionId: "practice-section-2",
                  groupId: null,
                  index: 0,
                }),
              );
              setNotice("Đã chuyển cả nhóm sang Section II.");
            }}
          >
            <ArrowDown className="h-4 w-4" />
            Chuyển cả nhóm sang Section II
          </Button>
        )}
      </div>
    );
  }
}
