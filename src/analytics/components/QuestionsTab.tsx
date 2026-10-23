// @ts-nocheck -- prototype: strict index-access checks relaxed
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { RichText } from "@/builder/components/RichText";
import { TYPE_LABEL } from "@/builder/ops";
import { cn } from "@/lib/utils";
import { distributionOf, RULES, sortStats, type QuestionStat, type SortKey } from "../metrics";
import type { Attempt } from "../types";
import { Card, Legend, pct, RateBar, Tag, WithN } from "./ui";

type Filter = "all" | "hard" | "easy";

export function QuestionPrompt({ q, className }: { q: QuestionStat["q"]; className?: string }) {
  const blank = q.blankRef ? `Chỗ trống (${q.blankRef})${q.groupLabel ? ` trong “${q.groupLabel}”` : ""}` : "";
  const opts = q.options?.map((o) => o.text).join(" · ") ?? "";
  const text = q.prompt.trim() ? q.prompt : [blank, opts].filter(Boolean).join(": ") || "(không có đề)";
  return <RichText text={text} className={className} renderBlank={(n) => <span className="mx-0.5 font-sans text-xs text-muted-foreground">({n})___</span>} />;
}

export function DifficultyTag({ d }: { d: QuestionStat["difficulty"] }) {
  if (d === "hard") return <Tag tone="destructive">Khó</Tag>;
  if (d === "easy") return <Tag tone="muted">Quá dễ</Tag>;
  return null;
}

function DistributionView({ s, done }: { s: QuestionStat; done: Attempt[] }) {
  const d = useMemo(() => distributionOf(s.q, done), [s, done]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {d.choices && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {s.q.type === "MATCHING" ? "Số em chọn từng chữ cái" : "Số em chọn từng phương án"}
            {s.q.type === "MULTIPLE_CHOICE" && " (một em có thể chọn nhiều)"}
          </div>
          <div className="space-y-1.5">
            {d.choices.map((c) => (
              <div key={c.letter} className="grid grid-cols-[1.5rem_minmax(0,1fr)_7rem] items-center gap-2 text-sm">
                <span className={cn("font-semibold", c.isCorrect ? "text-success" : "text-muted-foreground")}>{c.letter}</span>
                <span className="truncate"><RichText text={c.text} />{c.isCorrect && <span className="ml-1.5 text-xs text-success">✓ đúng</span>}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full", c.isCorrect ? "bg-success" : "bg-destructive/70")} style={{ width: `${d.n ? (c.count / d.n) * 100 : 0}%` }} /></span>
                  <span className="w-6 text-right tabular-nums">{c.count}</span>
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_7rem] items-center gap-2 text-sm text-muted-foreground">
              <span>—</span><span>Bỏ trống</span><span className="text-right tabular-nums">{d.unanswered}</span>
            </div>
          </div>
        </div>
      )}
      {d.wrong && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Đáp án sai phổ biến (đã chuẩn hoá)</div>
          {s.q.gradingMode === "MANUAL" ? (
            <p className="text-sm text-muted-foreground">Câu chấm tay: xem từng bài ở tab Học sinh.</p>
          ) : (
            <div className="space-y-3">
              {d.wrong.map((w) => (
                <div key={w.key}>
                  {w.label && <div className="mb-1 text-xs font-medium">{w.label}</div>}
                  {w.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có đáp án sai.</p>
                  ) : (
                    <ul className="space-y-1">
                      {w.items.map((it) => (
                        <li key={it.value} className="flex items-center justify-between gap-3 rounded border bg-background px-2 py-1 text-sm">
                          <span className="font-mono">“{it.value}”</span>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {it.count} em{it.variants > 1 && ` · gộp ${it.variants} cách viết`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {s.parts.length > 0 && (
        <div className={cn(!d.choices && "lg:col-span-1")}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theo từng chỗ trống</div>
          <div className="space-y-2">
            {s.parts.map((p) => (
              <div key={p.key} className="grid grid-cols-[6rem_minmax(0,1fr)_5rem] items-center gap-2 text-sm">
                <span>{p.label}</span>
                <RateBar row={p} />
                <span className="text-right tabular-nums">{pct(p.correctRate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestionsTab({ stats, done, openId, setOpenId }: { stats: QuestionStat[]; done: Attempt[]; openId: string | null; setOpenId: (id: string | null) => void }) {
  const [sort, setSort] = useState<SortKey>("order");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = sortStats(stats, sort).filter((s) => filter === "all" || s.difficulty === filter);
  const n = done.length;
  const seg = (k: string, v: string, cur: string, on: (x: any) => void) => (
    <button key={k} onClick={() => on(k)} className={cn("h-7 rounded px-2.5 text-sm", cur === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{v}</button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border p-0.5" aria-label="Sắp xếp">
          {seg("order", "Thứ tự đề", sort, setSort)}
          {seg("most_wrong", "Sai nhiều nhất", sort, setSort)}
          {seg("most_right", "Đúng nhiều nhất", sort, setSort)}
        </div>
        <div className="flex rounded-md border p-0.5" aria-label="Lọc">
          {seg("all", `Tất cả (${stats.length})`, filter, setFilter)}
          {seg("hard", `Khó (${stats.filter((s) => s.difficulty === "hard").length})`, filter, setFilter)}
          {seg("easy", `Quá dễ (${stats.filter((s) => s.difficulty === "easy").length})`, filter, setFilter)}
        </div>
        <div className="ml-auto"><Legend /></div>
      </div>
      <p className="text-xs text-muted-foreground">
        Tỉ lệ đúng = số em đúng / {n} bài đã nộp (bỏ trống vẫn tính ở mẫu số). Dưới {RULES.hardBelow * 100}% gắn “Khó”, trên {RULES.easyAbove * 100}% gắn “Quá dễ”.
        {n < RULES.discriminationMinN ? ` Chỉ số phân biệt chỉ hiện khi có từ ${RULES.discriminationMinN} bài (hiện ${n}).` : ""} Bấm vào một câu để xem các em chọn gì.
      </p>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="w-12 py-2">Câu</th>
              <th className="py-2">Nội dung</th>
              <th className="hidden w-32 py-2 md:table-cell">Loại</th>
              <th className="w-40 py-2">Kết quả</th>
              <th className="w-28 py-2 text-right">Đúng</th>
              <th className="w-20 py-2 text-right">Bỏ trống</th>
              {n >= RULES.discriminationMinN && <th className="w-20 py-2 text-right">Phân biệt</th>}
              <th className="w-28 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const open = openId === s.q.questionId;
              return (
                <Fragment key={s.q.questionId}>
                  <tr
                    id={`qrow-${s.q.questionId}`}
                    className={cn("cursor-pointer border-b last:border-0 hover:bg-muted/40", open && "bg-primary/5")}
                    onClick={() => setOpenId(open ? null : s.q.questionId)}
                    aria-expanded={open}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="py-2.5 font-semibold text-primary">{s.q.number}</td>
                    <td className="max-w-0 py-2.5 pr-3">
                      <div className="truncate"><QuestionPrompt q={s.q} /></div>
                      <div className="truncate text-xs text-muted-foreground">{s.q.sectionTitle}{s.q.groupLabel ? ` · ${s.q.groupLabel}` : ""}</div>
                    </td>
                    <td className="hidden py-2.5 text-xs text-muted-foreground md:table-cell">{TYPE_LABEL[s.q.type]}{s.q.gradingMode === "MANUAL" ? " · chấm tay" : ""}</td>
                    <td className="py-2.5 pr-3"><RateBar row={s} /></td>
                    <td className="py-2.5 text-right"><WithN value={pct(s.correctRate)} n={s.n} small={s.small} /></td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{pct(s.unansweredRate)}</td>
                    {n >= RULES.discriminationMinN && <td className="py-2.5 text-right tabular-nums">{s.discrimination?.toFixed(2) ?? "—"}</td>}
                    <td className="px-3 py-2.5 text-right"><DifficultyTag d={s.difficulty} /></td>
                  </tr>
                  {open && (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={9} className="px-6 py-4"><DistributionView s={s} done={done} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">Không có câu nào trong nhóm này.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
