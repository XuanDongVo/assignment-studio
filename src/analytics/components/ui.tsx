// @ts-nocheck -- prototype: strict index-access checks relaxed
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RateRow } from "../metrics";
import { PROGRESS_LABEL, RULES, type ProgressState } from "../metrics";
import type { PartStatus } from "../types";

export const pct = (x: number | null | undefined, digits = 0) => (x == null ? "—" : `${(x * 100).toFixed(digits)}%`);
export const score = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x)}%`);
export const num = (x: number | null | undefined, d = 1) => (x == null ? "—" : String(Math.round(x * 10 ** d) / 10 ** d));

const fmt = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const when = (iso: string | null | undefined) => (iso ? fmt.format(new Date(iso)) : "—");

/** Shows a figure with its n; faded when the sample is small. */
export function WithN({ value, n, small, className }: { value: ReactNode; n: number; small?: boolean; className?: string }) {
  return (
    <span className={cn("tabular-nums", small && "opacity-40", className)} title={small ? `Mẫu nhỏ: chỉ ${n} bài (dưới ${RULES.smallSampleBelow})` : undefined}>
      {value} <span className="text-xs text-muted-foreground">n={n}</span>
    </span>
  );
}

export const STATUS_CLASS: Record<PartStatus, string> = {
  CORRECT: "bg-success",
  PARTIAL: "bg-warning",
  INCORRECT: "bg-destructive",
  UNANSWERED: "bg-muted-foreground/25",
};
export const STATUS_TEXT: Record<PartStatus, string> = { CORRECT: "Đúng", PARTIAL: "Một phần", INCORRECT: "Sai", UNANSWERED: "Bỏ trống" };

/** Stacked bar: correct / partial / wrong / blank. */
export function RateBar({ row, className }: { row: RateRow; className?: string }) {
  const seg = (count: number, s: PartStatus) =>
    count > 0 ? <div key={s} className={cn("h-full", STATUS_CLASS[s])} style={{ width: `${(count / row.n) * 100}%` }} title={`${STATUS_TEXT[s]}: ${count}/${row.n}`} /> : null;
  return (
    <div className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-muted", row.small && "opacity-40", className)} role="img" aria-label={`Đúng ${row.correct}, một phần ${row.partial}, sai ${row.incorrect}, bỏ trống ${row.unanswered} trên ${row.n}`}>
      {seg(row.correct, "CORRECT")}
      {seg(row.partial, "PARTIAL")}
      {seg(row.incorrect, "INCORRECT")}
      {seg(row.unanswered, "UNANSWERED")}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {(Object.keys(STATUS_TEXT) as PartStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_CLASS[s])} /> {STATUS_TEXT[s]}</span>
      ))}
    </div>
  );
}

export function StatusChip({ status }: { status: PartStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-xs font-medium",
        status === "CORRECT" && "bg-success/10 text-success",
        status === "PARTIAL" && "bg-warning/15 text-warning-foreground",
        status === "INCORRECT" && "bg-destructive/10 text-destructive",
        status === "UNANSWERED" && "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

export const STATE_DOT: Record<ProgressState, string> = {
  submitted: "bg-success",
  late: "bg-warning",
  timed_out: "bg-warning",
  in_progress: "bg-primary",
  not_started: "bg-muted-foreground/40",
  overdue: "bg-destructive",
};

export function StateBadge({ state }: { state: ProgressState }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span className={cn("h-2 w-2 rounded-full", STATE_DOT[state])} /> {PROGRESS_LABEL[state]}
    </span>
  );
}

export function Tag({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "muted" | "destructive" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-semibold uppercase tracking-wide",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning-foreground",
        tone === "destructive" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Card({ title, children, className, action }: { title?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
