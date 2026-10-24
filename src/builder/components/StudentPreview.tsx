import { ArrowLeft, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { RawAnswer } from "@/analytics/types";
import { useBuilder } from "../store";
import { buildStudentView } from "../student-view";
import { isAnswered, StudentPaper, type PaperAnswers } from "./StudentPaper";

export function StudentPreview() {
  const a = useBuilder((s) => s.assignment);
  const set = useBuilder((s) => s.set);
  const view = useMemo(() => buildStudentView(a), [a]);
  const [answers, setAnswers] = useState<PaperAnswers>({});
  const [showPoints, setShowPoints] = useState(a.settings.showPoints);
  const setAnswer = (id: string, v: RawAnswer) => setAnswers((s) => ({ ...s, [id]: v }));
  const answered = Object.values(answers).filter(isAnswered).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => set({ mode: "edit" })}><ArrowLeft className="h-4 w-4" /> Back to Editor</Button>
        <span className="text-xs text-muted-foreground">Student preview · uses current unsaved changes · {answered}/{view.totalQuestions} answered</span>
        <div className="ml-auto flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Show points <Switch checked={showPoints} onCheckedChange={setShowPoints} /></label>
          <Button variant="outline" size="sm" onClick={() => setAnswers({})}><RotateCcw className="h-4 w-4" /> Reset answers</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-muted/40 px-4 py-6">
        <StudentPaper
          view={view}
          answers={answers}
          setAnswer={setAnswer}
          showPoints={showPoints}
          footer={<Button disabled title="Submitting is disabled in preview">Submit (disabled in preview)</Button>}
        />
      </div>
    </div>
  );
}
