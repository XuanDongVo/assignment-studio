import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, FileText, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { attemptApi, currentStudentId, setCurrentStudent } from "@/attempts/api";
import { TestTools } from "@/attempts/components/TestTools";
import { ROSTER } from "@/attempts/roster";
import type { AttemptStatus, MyAssignment } from "@/attempts/types";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "Bài tập của em · English Grades 6–8" },
      { name: "description", content: "Student view: assigned English assignments, one official attempt each, with autosave and a server-run timer." },
      { property: "og:title", content: "Bài tập của em · English Grades 6–8" },
      { property: "og:description", content: "See assigned English assignments, start or continue your attempt and view your results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentHome,
});

const STATE: Record<AttemptStatus, { label: string; cls: string; action: string }> = {
  NOT_STARTED: { label: "Chưa làm", cls: "text-muted-foreground", action: "Bắt đầu" },
  IN_PROGRESS: { label: "Đang làm", cls: "border-primary/30 bg-primary/5 text-primary", action: "Tiếp tục" },
  SUBMITTED: { label: "Đã nộp", cls: "border-success/30 bg-success/10 text-success", action: "Xem kết quả" },
  TIMED_OUT: { label: "Hết giờ", cls: "border-warning/40 bg-warning/10 text-warning-foreground", action: "Xem kết quả" },
};
const fmt = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function StudentHome() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [list, setList] = useState<MyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await attemptApi.myAssignments();
      if (r.ok) setList(r.data);
      else setError(r.message);
    } catch (e) {
      setError(`${(e as Error).message}. Thử lại khi có mạng.`);
    }
  }, []);

  useEffect(() => {
    const id = currentStudentId() ?? ROSTER[0]!.id;
    setCurrentStudent(id);
    setStudentId(id);
  }, []);
  useEffect(() => {
    if (!studentId) return;
    setList(null);
    void load();
    // Stands in for the server's scheduled job that completes expired attempts.
    const t = setInterval(() => void attemptApi.sweep().then(load).catch(() => {}), 15_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [studentId, load]);

  const me = ROSTER.find((s) => s.id === studentId);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/assignments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Trang giáo viên</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Bài tập của em</h1>
            <p className="text-sm text-muted-foreground">{me ? `${me.name} · lớp ${me.classId}` : "…"}</p>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Đăng nhập (mô phỏng) với tư cách
            <Select value={studentId ?? ""} onValueChange={(v) => (setCurrentStudent(v), setStudentId(v))}>
              <SelectTrigger className="w-64" aria-label="Chọn học sinh"><SelectValue placeholder="Chọn học sinh" /></SelectTrigger>
              <SelectContent>
                {ROSTER.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.classId}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-6 divide-y rounded-lg border bg-card">
          {error && (
            <div className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
              {error}
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Thử lại</Button>
            </div>
          )}
          {!error && list === null && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</p>}
          {list?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Chưa có bài nào được giao cho lớp {me?.classId}. (Bài phải ở trạng thái Published và giao cho lớp này.)</p>}
          {list?.map((a) => {
            const st = STATE[a.state];
            const pastDue = Date.now() > new Date(a.dueAt).getTime();
            const blocked = a.state === "NOT_STARTED" && !a.canStart;
            return (
              <div key={a.id} className="flex items-center gap-3 p-4">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{a.title}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
                    {a.late && <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground">Nộp muộn</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>Grade {a.grade} · {a.totalQuestions} câu</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{a.timeLimitMin ? `${a.timeLimitMin} phút` : "không giới hạn"}</span>
                    <span className={cn(pastDue && a.state !== "SUBMITTED" && a.state !== "TIMED_OUT" && "text-warning-foreground")}>Hạn {fmt(a.dueAt)}{pastDue && a.state === "NOT_STARTED" ? " · quá hạn, vẫn nộp được (muộn)" : ""}</span>
                  </div>
                  {blocked && a.reason && <div className="text-xs text-destructive">{a.reason}</div>}
                </div>
                {blocked ? (
                  <Button size="sm" disabled>{st.action}</Button>
                ) : (
                  <Button size="sm" variant={a.state === "NOT_STARTED" || a.state === "IN_PROGRESS" ? "default" : "outline"} asChild>
                    <Link to="/student/$assignmentId" params={{ assignmentId: a.id }}>{st.action}</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Bản mẫu: máy chủ được mô phỏng ngay trong trình duyệt, nên quy tắc “một màn hình” chỉ thử được giữa các tab của cùng trình duyệt.</p>
      </div>
      <TestTools onClock={load} />
    </div>
  );
}
