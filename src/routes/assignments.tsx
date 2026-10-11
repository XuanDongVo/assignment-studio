import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { computeNumbering, uid } from "@/builder/ops";
import { localRepository } from "@/builder/save-service";
import { createSeed } from "@/builder/seed";
import type { Assignment } from "@/builder/types";

export const Route = createFileRoute("/assignments")({
  head: () => ({
    meta: [
      { title: "My assignments · Assignment Builder" },
      { name: "description", content: "Your draft English assignments for Grades 6–8." },
      { property: "og:title", content: "My assignments · Assignment Builder" },
      { property: "og:description", content: "Your draft English assignments for Grades 6–8." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const [list, setList] = useState<Assignment[] | null>(null);
  const navigate = Route.useNavigate();
  useEffect(() => {
    localRepository.list().then(setList);
  }, []);
  const createNew = async () => {
    const a: Assignment = { ...createSeed(uid("asg")), title: "Untitled assignment", instructions: "", sections: [], items: {} };
    await localRepository.save(a);
    navigate({ to: "/", search: { id: a.id } });
  };
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My assignments</h1>
          <Button onClick={createNew}><Plus className="h-4 w-4" /> New assignment</Button>
        </div>
        <div className="mt-6 divide-y rounded-lg border bg-card">
          {list === null && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {list?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No assignments yet.</p>}
          {list?.map((a) => {
            const { total, points } = computeNumbering(a);
            return (
              <Link key={a.id} to="/" search={{ id: a.id }} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">Grade {a.grade} · {a.sections.length} sections · {total} questions · {points} pts · updated {new Date(a.updatedAt).toLocaleString()}</div>
                </div>
                <span className="text-sm text-primary">Open</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
