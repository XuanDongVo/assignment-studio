import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared markup renderer.
 *  [[ea]]           -> underlined text
 *  {{1}} / {{a|b}}  -> blank (rendered by renderBlank; n is the blank number)
 */
export function RichText({
  text,
  renderBlank,
  className,
}: {
  text: string;
  renderBlank?: (n: number, raw: string, index: number) => ReactNode;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  const re = /\[\[(.+?)\]\]|\{\{(.+?)\}\}/g;
  let last = 0;
  let blankIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      parts.push(
        <span key={m.index} className="underline decoration-2 underline-offset-4 font-semibold">
          {m[1]}
        </span>,
      );
    } else {
      const raw = m[2];
      const n = /^\d+$/.test(raw.trim()) ? Number(raw) : blankIdx + 1;
      parts.push(
        <Fragment key={m.index}>
          {renderBlank ? renderBlank(n, raw, blankIdx) : <span className="mx-0.5 inline-block w-16 border-b border-foreground/60 align-baseline" />}
        </Fragment>,
      );
      blankIdx++;
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={cn("whitespace-pre-wrap", className)}>{parts}</span>;
}

export function BlankChip({ n, active, onClick, label }: { n: number; active?: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "mx-0.5 inline-flex h-6 min-w-12 items-center justify-center gap-1 rounded border px-1.5 align-baseline font-sans text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
      )}
    >
      ({n}){label ? <span className="font-normal opacity-80">{label}</span> : null}
    </button>
  );
}
