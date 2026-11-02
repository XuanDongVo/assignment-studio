// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Student result + review page. Shown right after submitting and every time the student
 * reopens a finished assignment. Read-only: the paper is re-rendered with the student's saved
 * answers; correctness and the answer key appear only when the server sent `review`
 * (teacher's "show answers" setting).
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CheckCircle2, CircleDashed, Clock, Hourglass, Loader2, Lock, MinusCircle, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RawAnswer } from "@/analytics/types";
import { letter } from "@/builder/ops";
import type { SQuestion } from "@/builder/student-view";
import type { InteractionType } from "@/builder/types";
import { BlockView, isAnswered, scorableQuestions } from "@/builder/components/StudentPaper";
import { RichText } from "@/builder/components/RichText";
import type { ClientAttempt, ResultData, ReviewItem, ReviewStatus } from "../types";

const STATUS: Record<ReviewStatus, { label: string; icon: typeof Check; text: string; soft: string; bar: string; cell: string }> = {
  CORRECT: { label: "Đúng", icon: CheckCircle2, text: "text-success", soft: "border-success/30 bg-success/10", bar: "border-l-success", cell: "border-success bg-success text-success-foreground" },
  PARTIAL: { label: "Đúng một phần", icon: MinusCircle, text: "text-warning-foreground", soft: "border-warning/40 bg-warning/10", bar: "border-l-warning", cell: "border-warning bg-warning/70 text-foreground" },
  INCORRECT: { label: "Sai", icon: XCircle, text: "text-destructive", soft: "border-destructive/30 bg-destructive/10", bar: "border-l-destructive", cell: "border-destructive bg-destructive text-destructive-foreground" },
  UNANSWERED: { label: "Bỏ trống", icon: CircleDashed, text: "text-muted-foreground", soft: "border-border bg-muted", bar: "border-l-muted-foreground/40", cell: "border-dashed border-muted-foreground/60 bg-card text-muted-foreground" },
  PENDING: { label: "Chờ giáo viên chấm", icon: Hourglass, text: "text-primary", soft: "border-primary/30 bg-primary/5", bar: "border-l-primary", cell: "border-primary/40 bg-primary/10 text-primary" },
};

const TYPE_LABEL: Record<InteractionType, string> = {
  SINGLE_CHOICE: "Trắc nghiệm",
  MULTIPLE_CHOICE: "Chọn nhiều đáp án",
  TEXT_INPUT: "Điền / viết câu",
  MULTI_TEXT_INPUT: "Điền nhiều chỗ trống",
  MATCHING: "Nối đáp án",
};

type Filter = "all" | "INCORRECT" | "PARTIAL" | "UNANSWERED" | "CORRECT";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "INCORRECT", label: "Sai" },
  { id: "PARTIAL", label: "Một phần" },
  { id: "UNANSWERED", label: "Bỏ trống" },
  { id: "CORRECT", label: "Đúng" },
];

const when = (s: string | null) => (s ? new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—");
const pts = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
const plain = (t: string) => t.replace(/\[\[(.+?)\]\]/g, "$1");
function duration(a: string, b: string | null) {
  if (!b) return "—";
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} phút ${s % 60} giây` : `${s} giây`;
}
const qAnchor = (id: string) => `review-q-${id}`;

/* ---------- small pieces ---------- */

function StatusPill({ status }: { status: ReviewStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-xs font-medium", s.soft, s.text)}>
      <Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

function AnswerChip({ text, status }: { text: string; status: ReviewStatus | null }) {
  return (
    <span
      className={cn(
        "mx-1 inline-flex min-w-14 items-baseline justify-center rounded border px-1.5 font-sans text-sm leading-6",
        status ? cn(STATUS[status].soft, STATUS[status].text) : "border-primary/30 bg-primary/5",
        !text && "italic text-muted-foreground",
      )}
    >
      {text || "bỏ trống"}
    </span>
  );
}

function ScoreRing({ percent }: { percent: number | null }) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = p >= 80 ? "text-success" : p >= 50 ? "text-primary" : "text-warning";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke="currentColor" className={tone} strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums">{percent ?? "—"}%</div>
          <div className="text-[11px] text-muted-foreground">tỉ lệ điểm</div>
        </div>
      </div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function OptionRow({ l, text, chosen, correct, reveal }: { l: string; text: string; chosen: boolean; correct: boolean; reveal: boolean }) {
  const tone = reveal && correct ? "border-success/40 bg-success/10" : chosen && reveal ? "border-destructive/40 bg-destructive/10" : chosen ? "border-primary/40 bg-primary/5" : "border-transparent";
  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-2 py-1 text-[15px]", tone)}>
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border font-sans text-xs font-semibold", chosen ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>{l}</span>
      <span className="min-w-0 flex-1"><RichText text={text} /></span>
      <span className="flex shrink-0 items-center gap-2 font-sans text-xs">
        {chosen && <span className={cn("font-medium", reveal ? (correct ? "text-success" : "text-destructive") : "text-primary")}>Em chọn</span>}
        {reveal && correct && <span className="inline-flex items-center gap-0.5 font-medium text-success"><Check className="h-3.5 w-3.5" /> Đáp án đúng</span>}
      </span>
    </div>
  );
}

function KeyLine({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 rounded-md border border-success/30 bg-success/5 px-3 py-1.5 font-sans text-sm">
      <span className="text-xs font-medium text-success">Đáp án đúng</span>
      <span>{children}</span>
    </div>
  );
}

/* ---------- one question, read-only ---------- */

function ExampleQuestion({ q }: { q: SQuestion }) {
  const parts = q.exampleAnswer?.split(" / ") ?? [];
  return (
    <div className="rounded-md border border-dashed px-4 py-3 text-[15px] leading-8 text-muted-foreground">
      <span className="mr-2 font-sans text-xs font-semibold uppercase tracking-wide">Ví dụ</span>
      <RichText text={q.prompt} renderBlank={(_n, _r, i) => <AnswerChip text={(q.type === "MULTI_TEXT_INPUT" ? parts[i] : q.exampleAnswer) ?? ""} status={null} />} />
      {!q.prompt.includes("{{") && q.exampleAnswer && <div className="font-sans text-sm">→ {q.exampleAnswer}</div>}
    </div>
  );
}

function ReviewQuestion({ q, raw, r, reveal }: { q: SQuestion; raw: RawAnswer; r: ReviewItem | undefined; reveal: boolean }) {
  const st = reveal ? (r?.status ?? "UNANSWERED") : null;
  const answered = isAnswered(raw);
  const blanks = Array.isArray(raw) ? raw : [];
  const inlinePrompt = q.prompt.includes("{{");
  const inline = (_n: number, _raw: string, i: number) => {
    if (q.type === "TEXT_INPUT") return <AnswerChip text={typeof raw === "string" ? raw : ""} status={st} />;
    if (q.type === "MULTI_TEXT_INPUT") return <AnswerChip text={blanks[i] ?? ""} status={reveal ? (r?.parts[i]?.status ?? "UNANSWERED") : null} />;
    return <span className="mx-0.5 inline-block w-16 border-b border-foreground/60" />;
  };

  return (
    <div id={qAnchor(q.id)} className={cn("scroll-mt-24 rounded-md border border-l-4 bg-card px-4 py-3", st ? STATUS[st].bar : "border-l-primary/30")}>
      <div className="flex flex-wrap items-center gap-2 font-sans">
        <span className="text-sm font-semibold text-primary">Câu {q.number}{q.blankRef ? ` · chỗ trống (${q.blankRef})` : ""}</span>
        <span className="rounded border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">{TYPE_LABEL[q.type]}</span>
        <span className="ml-auto flex items-center gap-2">
          {st && <StatusPill status={st} />}
          <span className="text-xs tabular-nums text-muted-foreground">{reveal ? `${pts(r?.earned ?? 0)} / ${pts(q.points)} điểm` : `${pts(q.points)} điểm`}</span>
        </span>
      </div>

      {q.prompt && (
        <div className="mt-1 text-[15px] leading-8">
          <RichText text={q.prompt} renderBlank={inline} />
        </div>
      )}

      {(q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") && (
        <div className={cn("mt-1 grid gap-1", (q.options?.length ?? 0) > 2 && "sm:grid-cols-2")}>
          {q.options!.map((o, i) => {
            const chosen = q.type === "MULTIPLE_CHOICE" ? blanks.includes(o.id) : raw === o.id;
            return <OptionRow key={o.id} l={letter(i)} text={o.text} chosen={chosen} correct={!!r?.key.optionIds?.includes(o.id)} reveal={reveal} />;
          })}
        </div>
      )}

      {q.type === "TEXT_INPUT" && !inlinePrompt && (
        <div className="mt-1 flex flex-wrap items-baseline gap-1 text-[15px]">
          {q.prefix && <span>{q.prefix}</span>}
          <AnswerChip text={typeof raw === "string" ? raw : ""} status={st} />
          {q.cue && <span className="text-muted-foreground">{q.cue}</span>}
        </div>
      )}

      {q.type === "MATCHING" && (
        <div className="mt-1 flex flex-wrap items-center gap-2 font-sans text-sm">
          <span className="text-muted-foreground">Em chọn:</span>
          {(() => {
            const e = q.poolEntries?.find((x) => x.id === raw);
            return <AnswerChip text={e ? `${e.letter}. ${plain(e.text)}` : ""} status={st} />;
          })()}
        </div>
      )}

      {reveal && r && st !== "CORRECT" && st !== "PENDING" && (
        <>
          {q.type === "TEXT_INPUT" && (r.key.accepted?.length ?? 0) > 0 && <KeyLine>{r.key.accepted!.join("  /  ")}</KeyLine>}
          {q.type === "MATCHING" && (
            <KeyLine>
              {(() => {
                const e = q.poolEntries?.find((x) => x.id === r.key.entryId);
                return e ? `${e.letter}. ${plain(e.text)}` : "—";
              })()}
            </KeyLine>
          )}
          {q.type === "MULTI_TEXT_INPUT" && (
            <div className="mt-2 grid gap-1 rounded-md border border-success/30 bg-success/5 px-3 py-2 font-sans text-sm">
              <span className="text-xs font-medium text-success">Đáp án từng chỗ trống</span>
              {(r.key.blanks ?? []).map((acc, i) => {
                const ps = r.parts[i]?.status ?? "UNANSWERED";
                const Icon = STATUS[ps].icon;
                return (
                  <div key={i} className="flex flex-wrap items-baseline gap-2">
                    <span className="w-8 text-muted-foreground">({i + 1})</span>
                    <Icon className={cn("h-3.5 w-3.5 self-center", STATUS[ps].text)} />
                    <span className={cn(ps !== "CORRECT" && "text-muted-foreground line-through decoration-destructive/60")}>{blanks[i]?.trim() || "bỏ trống"}</span>
                    {ps !== "CORRECT" && <span>→ <b className="font-medium">{acc.join(" / ")}</b></span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!answered && <p className="mt-2 font-sans text-xs italic text-muted-foreground">Em chưa trả lời câu này.</p>}
      {st === "PENDING" && <p className="mt-2 font-sans text-xs text-primary">Câu này giáo viên sẽ chấm sau.</p>}
    </div>
  );
}

/* ---------- navigator ---------- */

function Navigator({ questions, cellState, onGo, children }: { questions: SQuestion[]; cellState: (q: SQuestion) => ReviewStatus | "ANSWERED"; onGo: (id: string) => void; children?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold">Danh sách câu</div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
        {questions.map((q) => {
          const s = cellState(q);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onGo(q.id)}
              title={s === "ANSWERED" ? "Đã trả lời" : STATUS[s].label}
              className={cn("h-9 rounded-md border text-xs font-semibold tabular-nums transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", s === "ANSWERED" ? "border-primary/40 bg-primary/10 text-primary" : STATUS[s].cell)}
            >
              {q.number}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/* ---------- page ---------- */

export function ResultView({ attempt, result }: { attempt: ClientAttempt; result: ResultData | null }) {
  const view = attempt.view;
  const reveal = !!result?.review;
  const [filter, setFilter] = useState<Filter>("all");
  const byId = useMemo(() => new Map((result?.review ?? []).map((r) => [r.questionId, r])), [result]);
  const questions = useMemo(() => scorableQuestions(view), [view]);
  const rawOf = (id: string) => attempt.answers[id]?.raw ?? null;
  const timedOut = attempt.status === "TIMED_OUT";

  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { CORRECT: 0, PARTIAL: 0, INCORRECT: 0, UNANSWERED: 0, PENDING: 0 };
    for (const r of result?.review ?? []) c[r.status]++;
    return c;
  }, [result]);
  const answeredCount = questions.filter((q) => isAnswered(rawOf(q.id))).length;

  const sectionStats = useMemo(
    () =>
      view.sections
        .map((s) => {
          const qs = s.units.flatMap((u) => (u.kind === "question" ? [u.q] : u.members)).filter((q) => !q.isExample);
          const rs = qs.map((q) => byId.get(q.id)).filter(Boolean) as ReviewItem[];
          const max = rs.reduce((x, r) => x + r.max, 0);
          const earned = rs.reduce((x, r) => x + r.earned, 0);
          return { id: s.id, titleEn: s.titleEn, titleVi: s.titleVi, total: qs.length, correct: rs.filter((r) => r.status === "CORRECT").length, earned, max };
        })
        .filter((s) => s.total > 0),
    [view, byId],
  );

  const visible = (q: SQuestion) => filter === "all" || (!q.isExample && byId.get(q.id)?.status === filter);
  const cellState = (q: SQuestion): ReviewStatus | "ANSWERED" => (reveal ? (byId.get(q.id)?.status ?? "UNANSWERED") : isAnswered(rawOf(q.id)) ? "ANSWERED" : "UNANSWERED");
  const goTo = (id: string) => {
    const q = questions.find((x) => x.id === id);
    const scroll = () => document.getElementById(qAnchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (q && !visible(q)) {
      setFilter("all");
      setTimeout(scroll, 60);
    } else scroll();
  };

  const legend = (
    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
      {(reveal ? (["CORRECT", "PARTIAL", "INCORRECT", "UNANSWERED"] as ReviewStatus[]) : []).map((s) => (
        <span key={s} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm border", STATUS[s].cell)} /> {STATUS[s].label}</span>
      ))}
      {!reveal && (
        <>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-primary/40 bg-primary/10" /> Đã trả lời</span>
          <span className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm border", STATUS.UNANSWERED.cell)} /> Bỏ trống</span>
        </>
      )}
    </div>
  );
  const nav = <Navigator questions={questions} cellState={cellState} onGo={goTo}>{legend}</Navigator>;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Button asChild variant="ghost" size="sm"><Link to="/student"><ArrowLeft className="h-4 w-4" /> Danh sách bài</Link></Button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{view.title}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Điểm</span>
            <span className="font-semibold tabular-nums">{pts(attempt.scoreEarned)} / {pts(attempt.scoreMax)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-6">
          {/* Summary */}
          <section className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing percent={attempt.percent} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {timedOut ? <Clock className="h-5 w-5 text-warning" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
                  <h1 className="text-lg font-semibold">{timedOut ? "Hết giờ — hệ thống đã tự nộp bài" : "Em đã nộp bài"}</h1>
                  {attempt.late && <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground">Nộp muộn</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">English · Grade {view.grade} · {view.title}</p>
                <div className="mt-3 text-4xl font-bold tabular-nums">
                  {pts(attempt.scoreEarned)}<span className="text-xl font-medium text-muted-foreground"> / {pts(attempt.scoreMax)} điểm</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Bắt đầu</dt><dd>{when(attempt.startedAt)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Hoàn tất</dt><dd>{when(attempt.finishedAt)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Thời gian làm</dt><dd>{duration(attempt.startedAt, attempt.finishedAt)}{view.timeLimitMin ? <span className="text-muted-foreground"> / {view.timeLimitMin} phút</span> : null}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Đã trả lời</dt><dd className="tabular-nums">{answeredCount} / {questions.length} câu</dd></div>
                </dl>
              </div>
            </div>

            {reveal && (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["CORRECT", "PARTIAL", "INCORRECT", "UNANSWERED"] as const).map((s) => {
                  const Icon = STATUS[s].icon;
                  const active = filter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFilter(active ? "all" : s)}
                      className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors", active ? STATUS[s].soft : "hover:bg-muted/60")}
                    >
                      <Icon className={cn("h-5 w-5", STATUS[s].text)} />
                      <span>
                        <span className="block text-xl font-semibold leading-none tabular-nums">{counts[s]}</span>
                        <span className="text-xs text-muted-foreground">{STATUS[s].label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm">
              {timedOut && <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning-foreground">Chỉ những câu trả lời đã lưu lên máy chủ trước khi hết giờ được chấm.</p>}
              {attempt.manualPendingCount > 0 && <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary">{attempt.manualPendingCount} câu do giáo viên chấm — điểm hiện tại là điểm tạm tính.</p>}
              {!result && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải kết quả chi tiết…</p>}
              {result && !reveal && (
                <p className="rounded-md border bg-muted/50 px-3 py-2">
                  {result.reviewMessage} Em vẫn xem lại được câu trả lời của mình bên dưới.
                </p>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Bài đã nộp không thể làm lại hoặc sửa câu trả lời.</p>
            </div>
          </section>

          {/* Per-section */}
          {reveal && sectionStats.length > 0 && (
            <section className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Kết quả theo phần</h2>
              <ul className="mt-3 divide-y">
                {sectionStats.map((s) => {
                  const p = s.max ? Math.round((s.earned / s.max) * 100) : 0;
                  return (
                    <li key={s.id} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_9.5rem]">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.titleEn}</div>
                        {s.titleVi && <div className="truncate text-xs text-muted-foreground">{s.titleVi}</div>}
                      </div>
                      <Bar value={p} />
                      <div className="text-right text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{pts(s.earned)}/{pts(s.max)}</span> điểm · {s.correct}/{s.total} đúng
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="lg:hidden">
            {nav}
          </div>

          {/* Review paper */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">Xem lại bài làm</h2>
              {reveal &&
                FILTERS.map((f) => {
                  const n = f.id === "all" ? questions.length : counts[f.id];
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                    >
                      {f.label} <span className="tabular-nums opacity-75">{n}</span>
                    </button>
                  );
                })}
            </div>

            <article className="rounded-lg border bg-paper font-serif shadow-sm">
              <div className="space-y-8 px-5 py-6 sm:px-8">
                {view.sections.map((s) => {
                  const units = s.units.filter((u) => (u.kind === "question" ? visible(u.q) : u.members.some(visible)));
                  if (!units.length) return null;
                  return (
                    <section key={s.id}>
                      <h3 className="text-lg font-bold">{s.titleEn}</h3>
                      {s.titleVi && <div className="font-sans text-xs text-muted-foreground">{s.titleVi}</div>}
                      {s.instructionsEn && <p className="mt-1 italic">{s.instructionsEn}</p>}
                      {s.instructionsVi && <p className="font-sans text-xs italic text-muted-foreground">{s.instructionsVi}</p>}
                      <div className="mt-3 space-y-3">
                        {units.map((u) =>
                          u.kind === "question" ? (
                            u.q.isExample ? <ExampleQuestion key={u.q.id} q={u.q} /> : <ReviewQuestion key={u.q.id} q={u.q} raw={rawOf(u.q.id)} r={byId.get(u.q.id)} reveal={reveal} />
                          ) : (
                            <div key={u.block.id} className="space-y-3 rounded-lg border border-dashed p-3">
                              <BlockView b={u.block} />
                              {u.members.filter(visible).map((q) =>
                                q.isExample ? <ExampleQuestion key={q.id} q={q} /> : <ReviewQuestion key={q.id} q={q} raw={rawOf(q.id)} r={byId.get(q.id)} reveal={reveal} />,
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </section>
                  );
                })}
                {filter !== "all" && !questions.some(visible) && <p className="py-6 text-center font-sans text-sm text-muted-foreground">Không có câu nào ở mục này.</p>}
              </div>
            </article>
          </section>

          <div className="flex justify-center">
            <Button asChild variant="outline"><Link to="/student"><ArrowLeft className="h-4 w-4" /> Về danh sách bài</Link></Button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20">
            {nav}
          </div>
        </aside>
      </main>
    </div>
  );
}
