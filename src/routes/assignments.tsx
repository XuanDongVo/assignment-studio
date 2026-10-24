import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, FileText, GraduationCap, Plus, Sparkles } from "lucide-react";
import { getResults } from "@/analytics/fake-data";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeNumbering, uid } from "@/builder/ops";
import { localRepository, resetDemo } from "@/builder/save-service";
import { createSeed } from "@/builder/seed";
import { STATUS_LABEL, statusOf } from "@/builder/status";
import { StatusPill } from "@/builder/components/PublishControl";
import type { Assignment, AssignmentStatus } from "@/builder/types";

export const Route = createFileRoute("/assignments")({
  head: () => ({
    meta: [
      { title: "My assignments · Assignment Builder" },
      { name: "description", content: "Your draft, published and archived English assignments for Grades 6–8." },
      { property: "og:title", content: "My assignments · Assignment Builder" },
      { property: "og:description", content: "Your draft, published and archived English assignments for Grades 6–8." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentsPage,
});

type Filter = "all" | AssignmentStatus;
const FILTERS: Filter[] = ["all", "draft", "published", "archived"];

function AssignmentsPage() {
  const [list, setList] = useState<Assignment[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const navigate = Route.useNavigate();
  useEffect(() => {
    localRepository.list().then(setList);
  }, []);
  const createNew = async () => {
    const a: Assignment = { ...createSeed(uid("asg")), title: "Untitled assignment", instructions: "", sections: [], items: {}, status: "draft", publishedAt: null };
    await localRepository.save(a);
    navigate({ to: "/", search: { id: a.id } });
  };
  const openDemo = async () => {
    const id = await resetDemo();
    navigate({ to: "/", search: { id } });
  };
  const count = (f: Filter) => (list ?? []).filter((a) => f === "all" || statusOf(a) === f).length;
  const shown = (list ?? []).filter((a) => filter === "all" || statusOf(a) === filter);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My assignments</h1>
          <div className="flex gap-2">
            <Button variant="ghost" asChild title="Thử làm bài như một học sinh">
              <Link to="/student"><GraduationCap className="h-4 w-4" /> Xem như học sinh</Link>
            </Button>
            <Button variant="outline" onClick={openDemo} title="Opens a fresh copy of the demo with every question type and shared block">
              <Sparkles className="h-4 w-4" /> Open full demo
            </Button>
            <Button onClick={createNew}><Plus className="h-4 w-4" /> New assignment</Button>
          </div>
        </div>
        <div role="tablist" aria-label="Filter by status" className="mt-6 flex gap-1 border-b">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm", filter === f ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 divide-y rounded-lg border bg-card">
          {list === null && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {list !== null && shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {filter === "all" ? "" : STATUS_LABEL[filter].toLowerCase() + " "}assignments.</p>}
          {shown.map((a) => {
            const { total, points } = computeNumbering(a);
            const st = statusOf(a);
            const hasResults = !!getResults(a.id);
            return (
              <div key={a.id} className={cn("flex items-center gap-3 p-4 hover:bg-muted/50", st === "archived" && "opacity-70")}>
                <Link to="/" search={{ id: a.id }} className="flex min-w-0 flex-1 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.title}</span>
                      <StatusPill status={st} />
                    </div>
                    <div className="text-xs text-muted-foreground">Grade {a.grade} · {a.sections.length} sections · {total} questions · {points} pts · updated {new Date(a.updatedAt).toLocaleString()}</div>
                  </div>
                </Link>
                <Link to="/results" search={{ id: a.id }} className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-sm", hasResults ? "border-primary/30 text-primary hover:bg-primary/5" : "text-muted-foreground hover:text-foreground")} title={hasResults ? "Có bài nộp (dữ liệu mẫu)" : "Chưa có bài nộp"}>
                  <BarChart3 className="h-4 w-4" /> Kết quả
                </Link>
                <Link to="/" search={{ id: a.id }} className="text-sm text-primary">Open</Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
