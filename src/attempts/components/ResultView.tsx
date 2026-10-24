import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientAttempt, ResultData, ReviewItem } from "../types";

const STATUS_TEXT: Record<ReviewItem["status"], string> = {
  CORRECT: "Đúng",
  PARTIAL: "Đúng một phần",
  INCORRECT: "Sai",
  UNANSWERED: "Chưa trả lời",
  PENDING: "Chờ giáo viên chấm",
};
const STATUS_CLS: Record<ReviewItem["status"], string> = {
  CORRECT: "text-success",
  PARTIAL: "text-warning-foreground",
  INCORRECT: "text-destructive",
  UNANSWERED: "text-muted-foreground",
  PENDING: "text-primary",
};
const when = (s: string | null) => (s ? new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—");

export function ResultView({ attempt, result }: { attempt: ClientAttempt; result: ResultData | null }) {
  const timedOut = attempt.status === "TIMED_OUT";
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          {timedOut ? <Clock className="h-5 w-5 text-warning" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
          <h1 className="text-xl font-semibold">{timedOut ? "Hết giờ — hệ thống đã tự nộp bài" : "Đã nộp bài"}</h1>
          {attempt.late && <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground">Nộp muộn</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{attempt.view.title}</p>
        {timedOut && <p className="mt-2 text-sm">Chỉ những câu trả lời máy chủ đã lưu trước khi hết giờ được chấm.</p>}
        <div className="mt-5 flex flex-wrap items-end gap-8">
          <div>
            <div className="text-xs text-muted-foreground">Điểm</div>
            <div className="text-3xl font-bold tabular-nums">
              {attempt.scoreEarned ?? "—"}<span className="text-lg font-medium text-muted-foreground"> / {attempt.scoreMax}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tỉ lệ</div>
            <div className="text-xl font-semibold tabular-nums">{attempt.percent ?? "—"}%</div>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>Bắt đầu: {when(attempt.startedAt)}</div>
            <div>Hoàn tất: {when(attempt.finishedAt)}</div>
          </div>
        </div>
        {attempt.manualPendingCount > 0 && (
          <p className="mt-3 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
            {attempt.manualPendingCount} câu do giáo viên chấm — điểm hiện tại là điểm tạm tính và có thể tăng.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Bài đã nộp không thể làm lại hoặc sửa câu trả lời.</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold">Đáp án</h2>
        {!result && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</p>}
        {result && !result.review && <p className="mt-2 text-sm text-muted-foreground">{result.reviewMessage}</p>}
        {result?.review && (
          <ol className="mt-3 divide-y">
            {result.review.map((r) => (
              <li key={r.questionId} className="grid grid-cols-[3.5rem_1fr] gap-2 py-2 text-sm">
                <span className="font-semibold text-primary">Câu {r.number}</span>
                <div>
                  <div className={cn("text-xs font-medium", STATUS_CLS[r.status])}>{STATUS_TEXT[r.status]}</div>
                  <div>Bạn trả lời: {r.yourAnswer.length ? r.yourAnswer.join("; ") : "—"}</div>
                  {r.status !== "CORRECT" && <div className="text-muted-foreground">Đáp án: {r.correct.join("; ")}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Button asChild variant="outline"><Link to="/student">Về danh sách bài</Link></Button>
    </div>
  );
}
