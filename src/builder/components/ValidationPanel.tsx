import { AlertCircle, AlertTriangle, CheckCircle2, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBuilder } from "../store";
import type { Issue } from "../validation";
import { useIssues } from "./Canvas";

export function goToIssue(i: Issue) {
  const st = useBuilder.getState();
  st.set({ mode: "edit" });
  st.select(i.target);
  setTimeout(() => {
    const el = document.getElementById(i.target.kind === "item" ? `item-${i.target.id}` : `section-${i.target.id}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 30);
}

export function ValidationPanel() {
  const issues = useIssues();
  const [open, setOpen] = useState(false);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return (
    <div className="border-t bg-card">
      <button onClick={() => setOpen(!open)} className="flex h-10 w-full items-center gap-4 px-4 text-sm">
        {errors.length === 0 ? (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Ready to publish
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertCircle className="h-4 w-4" /> {errors.length} error{errors.length === 1 ? "" : "s"}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-warning-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" /> {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{open ? "Hide" : "Show"} checks</span>
        <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "rotate-180")} />
      </button>
      {open && (
        <ul className="max-h-56 overflow-y-auto border-t">
          {issues.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No problems found.</li>}
          {[...errors, ...warnings].map((i) => (
            <li key={i.key} className="flex items-center gap-3 border-b px-4 py-1.5 text-sm last:border-0">
              {i.level === "error" ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
              <span className="min-w-0 flex-1 truncate">{i.message}</span>
              <button onClick={() => goToIssue(i)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                Go to item
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
