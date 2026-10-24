// @ts-nocheck -- prototype: strict index-access checks relaxed
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Lock, Maximize, MonitorX, RefreshCw, Send, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isAnswered, scorableQuestions, StudentPaper } from "@/builder/components/StudentPaper";
import { overallSync, usePlayer } from "../player";
import { ResultView } from "./ResultView";
import { TestTools } from "./TestTools";

const fmtWhen = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function enterFullscreen() {
  if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  window.focus();
}
function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

/** Seconds left by the server clock (null = no time limit). */
function useRemaining(expiresAt: string | null | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - (now + offset)) / 1000));
}

/**
 * Full screen is required while working. Leaving it, switching tab or window covers the paper,
 * locks the answers and counts a warning. Browsers cannot stop a student from switching, only detect it.
 */
function useLeaveGuard(enabled: boolean, attemptId: string | undefined) {
  const [away, setAway] = useState(false);
  const key = `ab.leaves.${attemptId}`;
  const [count, setCount] = useState(0);
  const prev = useRef(false);
  useEffect(() => {
    setCount(Number(sessionStorage.getItem(key) || 0));
  }, [key]);
  useEffect(() => {
    if (!enabled) {
      setAway(false);
      prev.current = false;
      return;
    }
    const fsRequired = document.fullscreenEnabled;
    const check = () => {
      const a = (fsRequired && !document.fullscreenElement) || document.hidden || !document.hasFocus();
      if (a && !prev.current) {
        const n = Number(sessionStorage.getItem(key) || 0) + 1;
        sessionStorage.setItem(key, String(n));
        setCount(n);
      }
      prev.current = a;
      setAway(a);
    };
    const t = setTimeout(check, 900); // give the browser time to enter full screen
    const evs = ["fullscreenchange", "visibilitychange"] as const;
    evs.forEach((e) => document.addEventListener(e, check));
    window.addEventListener("blur", check);
    window.addEventListener("focus", check);
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => {
      clearTimeout(t);
      evs.forEach((e) => document.removeEventListener(e, check));
      window.removeEventListener("blur", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("contextmenu", block);
    };
  }, [enabled, key]);
  return { away, count };
}

function SyncBadge() {
  const sync = usePlayer((s) => s.sync);
  const retry = usePlayer((s) => s.retryFailed);
  const { state, count } = overallSync(sync);
  const base = "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap";
  if (state === "failed")
    return (
      <span className={cn(base, "border-destructive/30 bg-destructive/5 text-destructive")}>
        <CloudOff className="h-3.5 w-3.5" /> Lưu thất bại · {count} câu
        <button onClick={retry} className="font-semibold underline">Thử lại</button>
      </span>
    );
  if (state === "saving") return <span className={cn(base, "border-primary/30 bg-primary/5 text-primary")}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang lưu…</span>;
  if (state === "pending") return <span className={cn(base, "border-warning/40 bg-warning/10 text-warning-foreground")}><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Chưa đồng bộ · {count} câu</span>;
  if (state === "saved") return <span className={cn(base, "border-success/30 bg-success/10 text-success")}><CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu</span>;
  return <span className={cn(base, "text-muted-foreground")}>Chưa có câu trả lời</span>;
}

function TimerBadge({ seconds }: { seconds: number | null }) {
  if (seconds == null) return <span className="text-xs text-muted-foreground">Không giới hạn thời gian</span>;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span
      aria-label="Thời gian còn lại"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-sm font-semibold tabular-nums",
        seconds <= 60 ? "border-destructive/40 bg-destructive/10 text-destructive" : seconds <= 300 ? "border-warning/40 bg-warning/10 text-warning-foreground" : "text-foreground",
      )}
    >
      <Timer className="h-4 w-4" /> {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Intro() {
  const { info, attempt, canStart, reason, busy, message, start, clockOffset } = usePlayer();
  const left = useRemaining(attempt?.expiresAt, clockOffset);
  const resuming = !!attempt;
  const pastDue = info && Date.now() + clockOffset > new Date(info.dueAt).getTime();
  return (
    <CenterCard>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">English · Grade {info?.grade}</div>
      <h1 className="mt-1 text-xl font-semibold">{info?.title}</h1>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{info?.totalQuestions} câu</span>
        <span>{info?.timeLimitMin ? `${info.timeLimitMin} phút` : "Không giới hạn thời gian"}</span>
        {info?.dueAt && <span>Hạn nộp {fmtWhen(info.dueAt)}</span>}
      </div>
      {pastDue && <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">Đã quá hạn nộp. Bạn vẫn làm và nộp được, bài sẽ bị đánh dấu <b>nộp muộn</b>.</p>}
      {resuming && (
        <p className="mt-3 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
          Bạn đang có lượt làm dở. {left != null ? `Còn ${Math.floor(left / 60)} phút ${left % 60} giây — đồng hồ vẫn chạy kể cả khi bạn rời đi.` : ""} Câu trả lời đã lưu sẽ được khôi phục.
        </p>
      )}
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        <li>Mỗi bạn chỉ có <b>một lượt làm</b>. Đã nộp thì không làm lại hay sửa được.</li>
        <li>Bài làm ở chế độ <b>toàn màn hình</b>. Chuyển tab, mở cửa sổ khác hoặc thoát toàn màn hình sẽ bị khóa bài và cảnh cáo.</li>
        <li>Chỉ làm trên <b>một màn hình</b>. Mở thêm tab hoặc thiết bị khác sẽ không thao tác được.</li>
        <li>Câu trả lời tự lưu lên máy chủ. Chỉ khi thấy <b>“Đã lưu”</b> thì câu trả lời mới chắc chắn được tính.</li>
        <li>Hết giờ, hệ thống tự nộp những câu đã lưu.</li>
      </ul>
      {!canStart && !resuming && reason && <p className="mt-4 text-sm text-destructive">{reason}</p>}
      {message && <p className="mt-4 text-sm text-destructive">{message}</p>}
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button asChild variant="ghost"><Link to="/student">Về danh sách</Link></Button>
        <Button disabled={busy || (!canStart && !resuming)} onClick={() => (enterFullscreen(), start())}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize className="h-4 w-4" />}
          {resuming ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
        </Button>
      </div>
    </CenterCard>
  );
}

function Elsewhere() {
  const { reclaim, busy, message } = usePlayer();
  return (
    <CenterCard>
      <div className="flex items-center gap-2 text-warning-foreground">
        <MonitorX className="h-5 w-5 text-warning" />
        <h1 className="text-lg font-semibold">Bài làm đang mở ở nơi khác</h1>
      </div>
      <p className="mt-3 text-sm">Assignment này đang được làm trên một tab hoặc thiết bị khác. Để tránh mất hoặc ghi đè câu trả lời, bạn không thể thao tác tại màn hình này.</p>
      <p className="mt-2 text-sm text-muted-foreground">Vui lòng quay lại màn hình đang làm bài. Nếu bạn đã đóng màn hình đó, hãy chờ hệ thống xác nhận phiên cũ đã kết thúc rồi thử lại.</p>
      {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
      <div className="mt-5 flex justify-between gap-2">
        <Button asChild variant="ghost"><Link to="/student">Về danh sách</Link></Button>
        <Button variant="outline" disabled={busy} onClick={reclaim}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Thử lại</Button>
      </div>
    </CenterCard>
  );
}

type SubmitStep = "closed" | "confirm" | "syncing" | "unsynced";

function Active() {
  const { attempt, values, setAnswer, clockOffset, submit, submitting, message, flush, checkTime, sync } = usePlayer();
  const seconds = useRemaining(attempt.expiresAt, clockOffset);
  const timeUp = seconds === 0;
  const { away, count } = useLeaveGuard(!timeUp && !attempt.finalizing, attempt.id);
  const [step, setStep] = useState<SubmitStep>("closed");
  const [unsynced, setUnsynced] = useState(0);
  const qs = useMemo(() => scorableQuestions(attempt.view), [attempt.view]);
  const unanswered = qs.filter((q) => !isAnswered(values[q.id]));
  const { state: syncState, count: syncCount } = overallSync(sync);
  const locked = away || timeUp || attempt.finalizing || submitting;

  // Time is up by the server clock: stop editing and let the server complete the attempt.
  useEffect(() => {
    if (!timeUp) return;
    setStep("closed");
    void checkTime();
    const t = setInterval(() => void checkTime(), 3000);
    return () => clearInterval(t);
  }, [timeUp, checkTime]);

  const doSubmit = async (force = false) => {
    if (!force) {
      setStep("syncing");
      const left = await flush();
      if (left > 0) {
        setUnsynced(left);
        setStep("unsynced");
        return;
      }
    }
    setStep("closed");
    await submit();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{attempt.view.title}</div>
          <div className="text-xs text-muted-foreground">Đã làm {qs.length - unanswered.length}/{qs.length} câu{count ? ` · Cảnh cáo rời màn hình: ${count}` : ""}</div>
        </div>
        <SyncBadge />
        <TimerBadge seconds={seconds} />
        <Button onClick={() => setStep("confirm")} disabled={locked}><Send className="h-4 w-4" /> Nộp bài</Button>
      </header>
      {(syncState === "failed" || (seconds != null && seconds <= 120 && syncState !== "saved" && syncState !== "none")) && !timeUp && (
        <div role="alert" className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {syncState === "failed"
            ? `Mất kết nối hoặc lưu lỗi: ${syncCount} câu chưa lên máy chủ. Nếu hết giờ, các câu này sẽ không được tính. Đừng đóng trang.`
            : "Sắp hết giờ và vẫn còn câu chưa lưu xong — hãy giữ kết nối mạng."}
        </div>
      )}
      {message && !timeUp && <div className="border-b bg-warning/10 px-4 py-1.5 text-sm text-warning-foreground">{message}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" inert={locked || undefined}>
        <StudentPaper view={attempt.view} answers={values} setAnswer={setAnswer} showPoints disabled={locked} />
      </div>

      {away && !timeUp && !attempt.finalizing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 px-4">
          <div role="alertdialog" aria-labelledby="away-title" className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-lg">
            <Lock className="mx-auto h-8 w-8 text-destructive" />
            <h2 id="away-title" className="mt-2 text-lg font-semibold">Bạn đã rời khỏi màn hình làm bài</h2>
            <p className="mt-1 text-sm font-medium text-destructive">Cảnh cáo lần {Math.max(count, 1)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Không được chuyển tab, mở cửa sổ khác hoặc thoát toàn màn hình khi đang làm bài. Bài làm bị khóa cho đến khi bạn quay lại. Đồng hồ vẫn tiếp tục chạy.</p>
            <Button className="mt-4" onClick={enterFullscreen}><Maximize className="h-4 w-4" /> Quay lại làm bài</Button>
          </div>
        </div>
      )}

      {(timeUp || attempt.finalizing || submitting) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-lg">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <h2 className="mt-2 text-lg font-semibold">{timeUp ? "Hết giờ — đang nộp bài" : "Đang hoàn tất bài nộp"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Câu trả lời đã khóa. Máy chủ chỉ chấm các câu đã lưu. Đang chờ máy chủ xác nhận…</p>
            {message && <p className="mt-2 text-sm text-warning-foreground">{message}</p>}
            {!timeUp && !submitting && <Button variant="outline" className="mt-4" onClick={() => submit()}><RefreshCw className="h-4 w-4" /> Thử lại</Button>}
          </div>
        </div>
      )}

      <Dialog open={step !== "closed"} onOpenChange={(o) => !o && step !== "syncing" && setStep("closed")}>
        <DialogContent className="z-[60]">
          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Nộp bài?</DialogTitle>
                <DialogDescription>Đã nộp thì không sửa được câu trả lời và không làm lại được.</DialogDescription>
              </DialogHeader>
              <p className="text-sm">Đã làm <b>{qs.length - unanswered.length}/{qs.length}</b> câu.</p>
              {unanswered.length > 0 && (
                <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                  Còn {unanswered.length} câu chưa trả lời ({unanswered.slice(0, 12).map((q) => q.number).join(", ")}{unanswered.length > 12 ? "…" : ""}). Bạn vẫn nộp được; các câu này được 0 điểm.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("closed")}>Làm tiếp</Button>
                <Button onClick={() => doSubmit()}><Send className="h-4 w-4" /> Nộp bài</Button>
              </DialogFooter>
            </>
          )}
          {step === "syncing" && (
            <div className="flex items-center gap-3 py-4 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Đang lưu các câu trả lời cuối cùng lên máy chủ…
            </div>
          )}
          {step === "unsynced" && (
            <>
              <DialogHeader>
                <DialogTitle>{unsynced} câu chưa lưu được</DialogTitle>
                <DialogDescription>Máy chủ chưa xác nhận {unsynced} câu trả lời. Nếu nộp bây giờ, các câu đó sẽ không được tính.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => doSubmit()}><RefreshCw className="h-4 w-4" /> Thử lưu lại</Button>
                <Button variant="destructive" onClick={() => doSubmit(true)}>Vẫn nộp</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExamPlayer({ assignmentId }: { assignmentId: string }) {
  const phase = usePlayer((s) => s.phase);
  const attempt = usePlayer((s) => s.attempt);
  const result = usePlayer((s) => s.result);
  const message = usePlayer((s) => s.message);
  const notice = usePlayer((s) => s.notice);
  const init = usePlayer((s) => s.init);

  useEffect(() => {
    void init(assignmentId);
    const onHide = () => usePlayer.getState().teardown();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      usePlayer.getState().teardown();
    };
  }, [assignmentId, init]);

  useEffect(() => {
    if (phase === "finished" || phase === "elsewhere") exitFullscreen();
  }, [phase]);

  useEffect(() => {
    if (!notice) return;
    toast.info(notice);
    usePlayer.setState({ notice: null });
  }, [notice]);

  // Leaving with unsaved answers: ask the browser to confirm.
  useEffect(() => {
    if (phase !== "active") return;
    const on = (e: BeforeUnloadEvent) => {
      if (overallSync(usePlayer.getState().sync).state === "saved") return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [phase]);

  return (
    <>
      {phase === "loading" && (
        <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {phase === "error" && (
        <CenterCard>
          <h1 className="text-lg font-semibold">Không mở được bài</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-5 flex justify-between">
            <Button asChild variant="ghost"><Link to="/student">Về danh sách</Link></Button>
            <Button variant="outline" onClick={() => init(assignmentId)}><RefreshCw className="h-4 w-4" /> Thử lại</Button>
          </div>
        </CenterCard>
      )}
      {phase === "intro" && <Intro />}
      {phase === "elsewhere" && <Elsewhere />}
      {phase === "active" && attempt && <Active />}
      {phase === "finished" && attempt && <div className="min-h-screen bg-muted/40"><ResultView attempt={attempt} result={result} /></div>}
      <TestTools
        assignmentId={assignmentId}
        onClock={() => (usePlayer.getState().phase === "active" ? void usePlayer.getState().checkTime() : void init(assignmentId))}
        onReset={() => void init(assignmentId)}
      />
    </>
  );
}
