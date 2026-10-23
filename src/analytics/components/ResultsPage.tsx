// @ts-nocheck -- prototype: strict index-access checks relaxed
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Info as InfoIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEMO_ID } from "@/builder/demo";
import { localRepository } from "@/builder/save-service";
import { statusOf } from "@/builder/status";
import type { Assignment } from "@/builder/types";
import { cn } from "@/lib/utils";
import { getResults } from "../fake-data";
import { classStats, overview, PROGRESS_LABEL, PROGRESS_ORDER, questionStats, RULES, sectionStats, studentRows, submittedAttempts, type ProgressState, type QuestionStat } from "../metrics";
import type { ResultsDataset } from "../types";
import { DifficultyTag, QuestionPrompt, QuestionsTab } from "./QuestionsTab";
import { StudentsTab } from "./StudentsTab";
import { Card, Kpi, Legend, num, pct, RateBar, score, STATE_DOT, when, WithN } from "./ui";

type Tab = "overview" | "questions" | "sections" | "students" | "classes";
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "overview", label: "Tổng quan", hint: "Cả lớp làm thế nào?" },
  { key: "questions", label: "Theo câu hỏi", hint: "Câu nào sai nhiều, sai vì sao?" },
  { key: "sections", label: "Theo phần", hint: "Yếu dạng bài nào?" },
  { key: "students", label: "Học sinh", hint: "Em nào cần chú ý?" },
  { key: "classes", label: "Theo lớp", hint: "Lớp nào khác lớp nào?" },
];

export function ResultsPage({ id }: { id?: string }) {
  const [assignment, setAssignment] = useState<Assignment | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return setAssignment(null);
    localRepository.get(id).then(setAssignment);
  }, [id]);
  const ds = useMemo(() => (id ? getResults(id) : null), [id]);

  if (assignment === undefined) return <div className="p-8 text-sm text-muted-foreground">Đang tải…</div>;
  const title = assignment?.title ?? "Bài tập";
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" search={id ? { id } : {}}><ArrowLeft className="h-4 w-4" /> Về trình soạn</Link>
        </Button>
        <BarChart3 className="h-4 w-4 text-primary" />
        <h1 className="min-w-0 truncate font-semibold">Kết quả · {title}</h1>
        {ds?.isSample && <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground">Dữ liệu mẫu</span>}
        <div className="ml-auto flex items-center gap-2">
          {ds && <span className="hidden text-xs text-muted-foreground md:inline">Số liệu lúc {when(ds.asOf)} · hạn nộp {when(ds.dueAt)}</span>}
          <Button variant="outline" size="sm" asChild><Link to="/assignments">Danh sách bài</Link></Button>
        </div>
      </header>
      {ds ? <Results ds={ds} /> : <Empty assignment={assignment} />}
    </div>
  );
}

function Empty({ assignment }: { assignment: Assignment | null }) {
  const st = assignment ? statusOf(assignment) : null;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border bg-card p-8 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">Chưa có bài nộp</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {st === "draft" ? "Bài đang là bản nháp — publish để học sinh làm, kết quả sẽ hiện ở đây." : "Khi học sinh nộp bài, kết quả sẽ hiện ở đây."} Hiện chỉ bài Demo có dữ liệu mẫu để xem thử.
      </p>
      <Button className="mt-4" asChild><Link to="/results" search={{ id: DEMO_ID }}>Xem kết quả mẫu của bài Demo</Link></Button>
    </div>
  );
}

function Results({ ds }: { ds: ResultsDataset }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<ProgressState | "all">("all");
  const [defsOpen, setDefsOpen] = useState(false);
  const ov = useMemo(() => overview(ds), [ds]);
  const done = useMemo(() => submittedAttempts(ds), [ds]);
  const qStats = useMemo(() => questionStats(done), [done]);
  const secs = useMemo(() => sectionStats(done), [done]);
  const students = useMemo(() => studentRows(ds), [ds]);
  const classes = useMemo(() => classStats(ds), [ds]);

  const goQuestion = (qid: string) => {
    setTab("questions");
    setOpenQ(qid);
    setTimeout(() => document.getElementById(`qrow-${qid}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  };
  const goStudents = (s: ProgressState | "all") => {
    setStateFilter(s);
    setTab("students");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-end gap-2 border-b" role="tablist" aria-label="Tầng phân tích">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-3 pb-2 pt-1 text-left", tab === t.key ? "border-primary" : "border-transparent hover:border-border")}
          >
            <div className={cn("text-sm", tab === t.key ? "font-semibold text-foreground" : "text-muted-foreground")}>{t.label}</div>
            <div className="text-[11px] text-muted-foreground">{t.hint}</div>
          </button>
        ))}
        <Button variant="ghost" size="sm" className="mb-1 ml-auto" onClick={() => setDefsOpen(true)}><InfoIcon className="h-4 w-4" /> Cách tính chỉ số</Button>
      </div>

      <div className="mt-5">
        {tab === "overview" && <Overview ds={ds} ov={ov} qStats={qStats} goQuestion={goQuestion} goStudents={goStudents} />}
        {tab === "questions" && <QuestionsTab stats={qStats} done={done} openId={openQ} setOpenId={setOpenQ} />}
        {tab === "sections" && <Sections secs={secs} />}
        {tab === "students" && <StudentsTab rows={students} done={done} mean={ov.mean} stateFilter={stateFilter} setStateFilter={setStateFilter} />}
        {tab === "classes" && <Classes classes={classes} ds={ds} />}
      </div>
      <Definitions open={defsOpen} onOpenChange={setDefsOpen} />
    </div>
  );
}

function Overview({ ds, ov, qStats, goQuestion, goStudents }: { ds: ResultsDataset; ov: ReturnType<typeof overview>; qStats: QuestionStat[]; goQuestion: (id: string) => void; goStudents: (s: ProgressState | "all") => void }) {
  const maxBin = Math.max(1, ...ov.bins.map((b) => b.count));
  const hard = qStats.filter((s) => s.difficulty === "hard").sort((a, b) => a.correctRate! - b.correctRate!);
  const easy = qStats.filter((s) => s.difficulty === "easy");
  const timeRatio = ov.avgMinutes != null && ov.timeLimitMin ? ov.avgMinutes / ov.timeLimitMin : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tỉ lệ nộp" value={pct(ov.submissionRate)} sub={`${ov.submitted}/${ov.assigned} học sinh được giao`} />
        <Kpi label="Điểm trung bình" value={score(ov.mean)} sub={`Trung vị ${score(ov.median)} · tính trên ${ov.submitted} bài đã nộp`} />
        <Kpi label="Thấp nhất – cao nhất" value={`${score(ov.min)} – ${score(ov.max)}`} sub="Kể cả bài hết giờ" />
        <Kpi
          label="Thời gian làm trung bình"
          value={ov.avgMinutes == null ? "—" : `${Math.round(ov.avgMinutes)} phút`}
          sub={
            ov.timeLimitMin ? (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.min(1, timeRatio ?? 0) * 100}%` }} /></span>
                giới hạn {ov.timeLimitMin} phút
              </span>
            ) : "Không giới hạn thời gian"
          }
        />
      </div>

      <Card title="Tiến độ" action={<button onClick={() => goStudents("all")} className="text-xs text-primary hover:underline">Xem danh sách học sinh</button>}>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {PROGRESS_ORDER.map((s) => ov.counts[s] > 0 && <div key={s} className={STATE_DOT[s]} style={{ width: `${(ov.counts[s] / ov.assigned) * 100}%` }} title={`${PROGRESS_LABEL[s]}: ${ov.counts[s]}`} />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PROGRESS_ORDER.map((s) => (
            <button key={s} onClick={() => goStudents(s)} className="rounded-md border px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", STATE_DOT[s])} /> {PROGRESS_LABEL[s]}</div>
              <div className="text-lg font-semibold tabular-nums">{ov.counts[s]}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Hạn nộp {when(ds.dueAt)} đã qua nên em chưa mở bài được tính là “Quá hạn”. Bài “Đang làm” chưa tính vào bất kỳ chỉ số nào.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Phân bố điểm" action={<span className="text-xs text-muted-foreground">n={ov.submitted} bài đã nộp</span>}>
          <div className="flex h-40 items-end gap-1.5">
            {ov.bins.map((b) => (
              <div key={b.from} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-muted-foreground">{b.count || ""}</span>
                <div className={cn("w-full rounded-t", b.from < 50 ? "bg-destructive/60" : "bg-primary/70")} style={{ height: `${(b.count / maxBin) * 100}%`, minHeight: b.count ? 4 : 0 }} title={`${b.from}–${b.to}%: ${b.count} em`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 border-t pt-1">
            {ov.bins.map((b) => <span key={b.from} className="flex-1 text-center text-[10px] text-muted-foreground">{b.from}{b.from === 90 ? "–100" : ""}</span>)}
          </div>
          {ov.mean != null && <p className="mt-2 text-xs text-muted-foreground">Cột đỏ: dưới 50%. Trung bình {num(ov.mean)}%, trung vị {num(ov.median)}%.</p>}
        </Card>

        <Card title="Câu cần chú ý">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-destructive">Đúng dưới {RULES.hardBelow * 100}% — nên xem lại ({hard.length})</div>
              {hard.length === 0 ? <p className="text-sm text-muted-foreground">Không có.</p> : hard.map((s) => <QLink key={s.q.questionId} s={s} onClick={() => goQuestion(s.q.questionId)} />)}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Đúng trên {RULES.easyAbove * 100}% — có thể quá dễ ({easy.length})</div>
              {easy.length === 0 ? <p className="text-sm text-muted-foreground">Không có.</p> : easy.map((s) => <QLink key={s.q.questionId} s={s} onClick={() => goQuestion(s.q.questionId)} />)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function QLink({ s, onClick }: { s: QuestionStat; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted">
      <span className="w-10 shrink-0 font-semibold text-primary">Câu {s.q.number}</span>
      <span className="min-w-0 flex-1 truncate"><QuestionPrompt q={s.q} /></span>
      <span className="shrink-0 tabular-nums">{pct(s.correctRate)}</span>
    </button>
  );
}

function Sections({ secs }: { secs: ReturnType<typeof sectionStats> }) {
  const weakest = [...secs].sort((a, b) => (a.correctRate ?? 0) - (b.correctRate ?? 0))[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          % đúng = số câu đúng hoàn toàn / (số câu × số bài). % điểm tính cả điểm một phần.
          {weakest && <> Yếu nhất: <span className="font-medium text-foreground">{weakest.title}</span> ({pct(weakest.correctRate)}).</>}
        </p>
        <Legend />
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2">Phần</th><th className="w-16 py-2 text-right">Số câu</th><th className="w-56 px-4 py-2">Kết quả</th><th className="w-28 py-2 text-right">% đúng</th><th className="w-20 py-2 text-right">% điểm</th><th className="w-24 px-4 py-2 text-right">Bỏ trống</th></tr>
          </thead>
          <tbody>
            {secs.map((s) => (
              <tr key={s.sectionId} className={cn("border-b last:border-0", s === weakest && "bg-destructive/5")}>
                <td className="px-4 py-3 font-medium">{s.title}</td>
                <td className="py-3 text-right tabular-nums">{s.questions}</td>
                <td className="px-4 py-3"><RateBar row={s} /></td>
                <td className="py-3 text-right"><WithN value={pct(s.correctRate)} n={s.n} small={s.small} /></td>
                <td className="py-3 text-right tabular-nums">{pct(s.pointsRate)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{pct(s.unansweredRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Classes({ classes, ds }: { classes: ReturnType<typeof classStats>; ds: ResultsDataset }) {
  return (
    <div className="space-y-4">
      {classes.length < 2 && (
        <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
          Bài này đang giao cho {ds.assignedClassIds.length} lớp ({ds.assignedClassIds.join(", ")}), nên chưa có gì để so sánh. Khi giao nhiều lớp, mỗi lớp là một dòng. Bài đã làm luôn tính vào lớp lúc bắt đầu làm — em chuyển lớp sau đó vẫn ở lớp cũ.
        </p>
      )}
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2">Lớp</th><th className="py-2 text-right">Được giao</th><th className="py-2 text-right">Tỉ lệ nộp</th><th className="py-2 text-right">Điểm TB</th><th className="py-2 text-right">Trung vị</th><th className="w-48 px-4 py-2">Tỉ lệ đúng tất cả câu</th><th className="px-4 py-2 text-right">% đúng</th></tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.classId} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{c.classId}</td>
                <td className="py-3 text-right tabular-nums">{c.assigned}</td>
                <td className="py-3 text-right tabular-nums">{pct(c.submissionRate)} <span className="text-xs text-muted-foreground">({c.submitted})</span></td>
                <td className="py-3 text-right"><WithN value={score(c.mean)} n={c.submitted} small={c.small} /></td>
                <td className="py-3 text-right tabular-nums">{score(c.median)}</td>
                <td className="px-4 py-3"><RateBar row={{ ...c, small: c.small }} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(c.correctRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const DEFS: [string, string, string][] = [
  ["Tỉ lệ nộp", "Số đã nộp / số học sinh được giao", "“Chưa làm” tính theo lớp hiện tại; bài đã làm tính theo lớp lúc bắt đầu."],
  ["Điểm bài", "Điểm đạt / điểm tối đa × 100", "Trung bình tính trên bài đã nộp, kể cả hết giờ."],
  ["Tỉ lệ đúng của câu", "Số ĐÚNG / số bài đã nộp", "Bỏ trống nằm ở mẫu số."],
  ["Tỉ lệ bỏ trống", "Số BỎ TRỐNG / số bài đã nộp", "Hiện riêng. Không tách “bỏ trống do hết giờ” vì không lưu thời điểm trả lời từng câu."],
  ["Đáp án sai phổ biến", "Đếm theo giá trị đã chuẩn hoá", "Gộp viết hoa, thừa khoảng trắng, dấu chấm cuối câu."],
  ["Chỉ số phân biệt", "% đúng nhóm 27% điểm cao − nhóm 27% điểm thấp", `Chỉ tính khi có từ ${RULES.discriminationMinN} bài trở lên.`],
  ["Ngưỡng gợi ý", `Đúng dưới ${RULES.hardBelow * 100}% = khó, trên ${RULES.easyAbove * 100}% = quá dễ`, "Chỉ là gợi ý để giáo viên xem lại câu."],
  ["Loại trừ", "Câu ví dụ, bài đang làm", "Không tính vào mọi chỉ số."],
  ["Mẫu nhỏ", "Luôn hiện n cạnh phần trăm", `Làm mờ khi n dưới ${RULES.smallSampleBelow}.`],
];

function Definitions({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cách tính chỉ số</DialogTitle>
          <DialogDescription>Mọi màn hình dùng chung các định nghĩa này.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {DEFS.map(([k, f, note]) => (
              <tr key={k} className="border-b align-top last:border-0">
                <td className="py-2 pr-3 font-medium">{k}</td>
                <td className="py-2 pr-3">{f}</td>
                <td className="py-2 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
