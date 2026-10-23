// @ts-nocheck -- prototype: strict index-access checks relaxed
import { Eye, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { displayAnswer, displayKey, questionStatus } from "../grading";
import { durationMin, PROGRESS_LABEL, PROGRESS_ORDER, sectionScoresOf, sectionStats, type ProgressState, type studentRows } from "../metrics";
import type { Attempt } from "../types";
import { QuestionPrompt } from "./QuestionsTab";
import { Card, num, pct, score, StateBadge, StatusChip, Tag, when } from "./ui";

type Row = ReturnType<typeof studentRows>[number];

export function StudentsTab({ rows, done, mean, stateFilter, setStateFilter }: { rows: Row[]; done: Attempt[]; mean: number | null; stateFilter: ProgressState | "all"; setStateFilter: (s: ProgressState | "all") => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "low" | "high">("name");
  const shown = rows
    .filter((r) => stateFilter === "all" || r.state === stateFilter)
    .filter((r) => r.student.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) =>
      sortBy === "name"
        ? a.student.name.split(" ").pop()!.localeCompare(b.student.name.split(" ").pop()!, "vi")
        : sortBy === "low"
          ? (a.percent ?? 999) - (b.percent ?? 999)
          : (b.percent ?? -1) - (a.percent ?? -1),
    );
  const count = (s: ProgressState) => rows.filter((r) => r.state === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm học sinh…" aria-label="Tìm học sinh" className="h-8 w-52 rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:border-primary" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...PROGRESS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={cn("h-8 rounded-md border px-2.5 text-sm", stateFilter === s ? "border-primary bg-primary/5 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {s === "all" ? `Tất cả (${rows.length})` : `${PROGRESS_LABEL[s]} (${count(s)})`}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sắp xếp" className="ml-auto h-8 rounded-md border bg-background px-2 text-sm">
          <option value="name">Theo tên</option>
          <option value="low">Điểm thấp trước</option>
          <option value="high">Điểm cao trước</option>
        </select>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Học sinh</th>
              <th className="py-2">Lớp</th>
              <th className="py-2">Trạng thái</th>
              <th className="py-2 text-right">Điểm</th>
              <th className="py-2 text-right">%</th>
              <th className="py-2 text-right" title="So với điểm trung bình lớp">So với TB</th>
              <th className="py-2 text-right">Thời gian</th>
              <th className="py-2 text-right">Bỏ trống</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.student.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{r.student.name}</td>
                <td className="py-2.5">
                  {r.statsClassId}
                  {r.student.classId !== r.statsClassId && <span className="ml-1 text-xs text-muted-foreground" title="Lớp lúc bắt đầu làm bài khác lớp hiện tại">(nay {r.student.classId})</span>}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <StateBadge state={r.state} />
                    {r.attempt?.late && r.state !== "late" && <Tag>Late</Tag>}
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.earned == null ? "—" : `${num(r.earned)}/${num(r.max)}`}</td>
                <td className={cn("py-2.5 text-right font-medium tabular-nums", r.percent != null && r.percent < 50 && "text-destructive")}>{score(r.percent)}</td>
                <td className={cn("py-2.5 text-right tabular-nums", r.vsMean == null ? "text-muted-foreground" : r.vsMean >= 0 ? "text-success" : "text-destructive")}>
                  {r.vsMean == null ? "—" : `${r.vsMean >= 0 ? "+" : ""}${Math.round(r.vsMean)}`}
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{r.minutes == null ? "—" : `${Math.round(r.minutes)} ph`}</td>
                <td className={cn("py-2.5 text-right tabular-nums", r.blanks ? "text-foreground" : "text-muted-foreground")}>{r.blanks ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.attempt ? (
                    <Button size="sm" variant="outline" onClick={() => setOpen(r)}><Eye className="h-3.5 w-3.5" /> Xem bài</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Chưa mở bài</span>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Không có học sinh nào.</td></tr>}
          </tbody>
        </table>
      </Card>
      <AttemptSheet row={open} done={done} mean={mean} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Read-only view of one student's work (teacher only). */
function AttemptSheet({ row, done, mean, onClose }: { row: Row | null; done: Attempt[]; mean: number | null; onClose: () => void }) {
  const a = row?.attempt;
  const classSections = useMemo(() => Object.fromEntries(sectionStats(done).map((s) => [s.sectionId, s.pointsRate])), [done]);
  const submitted = !!a?.submittedAt;
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {row && a && (
          <>
            <SheetHeader>
              <SheetTitle>{row.student.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Chế độ chỉ đọc · chỉ giáo viên xem được</SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Điểm" value={submitted ? `${num(a.scoreEarned)}/${num(a.scoreMax)} · ${score(a.percent)}` : "Chưa nộp"} />
              <Info label="So với TB lớp" value={submitted && mean != null ? `${a.percent! - mean >= 0 ? "+" : ""}${Math.round(a.percent! - mean)} (TB ${score(mean)})` : "—"} />
              <Info label="Thời gian" value={submitted ? `${Math.round(durationMin(a)!)} phút` : "—"} />
              <Info label="Lớp lúc làm" value={a.classIdAtStart} />
              <Info label="Bắt đầu" value={when(a.startedAt)} />
              <Info label="Nộp lúc" value={when(a.submittedAt)} />
              <div className="col-span-2 flex items-end gap-1.5">
                <StateBadge state={row.state} />
                {a.late && <Tag>Late</Tag>}
                {a.timedOut && <Tag>Timed out</Tag>}
              </div>
            </div>
            {!submitted && <p className="mt-4 rounded border border-primary/30 bg-primary/5 p-3 text-sm">Em đang làm bài. Câu trả lời đã lưu được hiển thị bên dưới, chưa chấm điểm và chưa tính vào thống kê.</p>}

            {submitted && (
              <div className="mt-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theo phần của đề</h4>
                <div className="space-y-1.5">
                  {sectionScoresOf(a).map((s) => (
                    <div key={s.sectionId} className="grid grid-cols-[minmax(0,1fr)_8rem_5.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{s.title}</span>
                      <span className="relative h-2 rounded-full bg-muted">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(s.rate ?? 0) * 100}%` }} />
                        {classSections[s.sectionId] != null && <span className="absolute -top-1 h-4 w-0.5 bg-foreground/60" style={{ left: `${classSections[s.sectionId] * 100}%` }} title={`TB lớp ${pct(classSections[s.sectionId])}`} />}
                      </span>
                      <span className="text-right text-xs tabular-nums">{num(s.earned)}/{num(s.max)} <span className="text-muted-foreground">· lớp {pct(classSections[s.sectionId])}</span></span>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Vạch dọc = trung bình lớp.</p>
              </div>
            )}

            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Từng câu</h4>
              {a.questions.filter((q) => !q.isExample).map((q) => {
                const r = a.responses.find((x) => x.questionId === q.questionId);
                const st = submitted ? questionStatus(r?.parts ?? []) : null;
                const ans = displayAnswer(q, r?.raw ?? null);
                const earned = r?.parts.reduce((s, p) => s + p.earned, 0) ?? 0;
                return (
                  <div key={q.questionId} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-primary">Câu {q.number}.</span>
                      <div className="min-w-0 flex-1"><QuestionPrompt q={q} /></div>
                      {st && <StatusChip status={st} />}
                      {submitted && <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{num(earned)}/{num(q.points)}</span>}
                    </div>
                    <div className="mt-2 grid gap-1 pl-1 sm:grid-cols-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Em trả lời: </span>
                        {ans.length ? ans.map((x, i) => <div key={i} className="font-medium">{x}</div>) : <span className="italic text-muted-foreground">bỏ trống</span>}
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Đáp án đúng: </span>
                        {displayKey(q).map((x, i) => <div key={i} className="text-success">{x}</div>)}
                      </div>
                    </div>
                    {submitted && r && r.parts.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.parts.map((p, i) => <span key={p.key} className="flex items-center gap-1 text-xs">({i + 1}) <StatusChip status={p.status} /></span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
