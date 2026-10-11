import { ArrowLeft, Clock, ImageIcon, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { letter } from "../ops";
import { useBuilder } from "../store";
import { buildStudentView, type SBlock, type SQuestion } from "../student-view";
import { BlankChip, RichText } from "./RichText";

type Answers = Record<string, string | string[] | Record<number, string>>;

function InlineInput({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="mx-1 inline-block h-7 w-36 rounded-none border-0 border-b-2 border-primary/40 bg-primary/5 px-1.5 font-sans text-sm outline-none focus:border-primary disabled:border-success disabled:bg-success/10 disabled:text-success"
    />
  );
}

function QuestionView({ q, answers, setAnswer, showPoints }: { q: SQuestion; answers: Answers; setAnswer: (id: string, v: Answers[string]) => void; showPoints: boolean }) {
  const val = answers[q.id];
  const ex = q.isExample;
  const blanks = (val as Record<number, string>) ?? {};
  const head = (
    <span className="mr-2 font-sans text-sm font-semibold text-primary">
      {ex ? "Example:" : `Câu ${q.number}.`}
      {q.blankRef ? ` (${q.blankRef})` : ""}
    </span>
  );
  const pts = showPoints && !ex ? <span className="ml-2 font-sans text-xs text-muted-foreground">({q.points} pt)</span> : null;

  const inlineBlank = (_n: number, _raw: string, i: number) => {
    if (q.type === "TEXT_INPUT") return <InlineInput label={`Answer for question ${q.number}`} disabled={ex} value={ex ? q.exampleAnswer ?? "" : (val as string) ?? ""} onChange={(v) => setAnswer(q.id, v)} />;
    if (q.type === "MULTI_TEXT_INPUT")
      return <InlineInput label={`Blank ${i + 1}`} disabled={ex} value={ex ? q.exampleAnswer?.split(" / ")[i] ?? "" : blanks[i] ?? ""} onChange={(v) => setAnswer(q.id, { ...blanks, [i]: v })} />;
    return <span className="mx-0.5 inline-block w-16 border-b border-foreground/60" />;
  };

  return (
    <div className="py-2">
      <div className="text-[15px] leading-8">
        {head}
        {q.prompt && <RichText text={q.prompt} renderBlank={inlineBlank} />}
        {pts}
      </div>
      {(q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") &&
        (q.display === "dropdown" ? (
          <Select value={(val as string) ?? ""} onValueChange={(v) => setAnswer(q.id, v)} disabled={ex}>
            <SelectTrigger className="mt-1 h-8 w-56 font-sans"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {q.options!.map((o, i) => <SelectItem key={o.id} value={o.id}>{letter(i)}. {o.text.replace(/\[\[(.+?)\]\]/g, "$1")}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className={cn("mt-1 grid gap-x-6 gap-y-1 pl-6", q.options!.length > 2 && "sm:grid-cols-4")}>
            {q.options!.map((o, i) => {
              const multi = q.type === "MULTIPLE_CHOICE";
              const checked = multi ? ((val as string[]) ?? []).includes(o.id) : val === o.id;
              return (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 text-[15px]">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={`ans-${q.id}`}
                    checked={checked}
                    disabled={ex}
                    className="h-4 w-4 accent-primary"
                    onChange={() => setAnswer(q.id, multi ? (checked ? ((val as string[]) ?? []).filter((x) => x !== o.id) : [...((val as string[]) ?? []), o.id]) : o.id)}
                  />
                  <span className="font-sans text-xs text-muted-foreground">{letter(i)}.</span>
                  <RichText text={o.text} />
                </label>
              );
            })}
          </div>
        ))}
      {q.type === "TEXT_INPUT" && !q.prompt.includes("{{") && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-6 text-[15px]">
          {q.prefix && <span>{q.prefix}</span>}
          <input
            aria-label={`Answer for question ${q.number ?? "example"}`}
            disabled={ex}
            value={ex ? q.exampleAnswer ?? "" : (val as string) ?? ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            className="h-8 min-w-0 flex-1 border-0 border-b-2 border-primary/40 bg-transparent px-1 font-sans text-sm outline-none focus:border-primary disabled:border-success disabled:text-success"
          />
          {q.cue && <span className="text-muted-foreground">{q.cue}</span>}
        </div>
      )}
      {q.type === "MATCHING" && (
        <Select value={ex ? q.poolEntries?.find((e) => e.letter === q.exampleAnswer)?.id ?? "" : (val as string) ?? ""} onValueChange={(v) => setAnswer(q.id, v)} disabled={ex}>
          <SelectTrigger className="mt-1 ml-6 h-8 w-24 font-sans"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {q.poolEntries!.map((e) => <SelectItem key={e.id} value={e.id}>{e.letter}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function BlockView({ b }: { b: SBlock }) {
  if (b.type === "INSTRUCTIONS") return <p className="italic text-muted-foreground">{b.text}</p>;
  if (b.type === "MEDIA")
    return b.url ? (
      <img src={b.url} alt={b.alt} className="max-h-56 rounded border" />
    ) : (
      <div role="img" aria-label={b.alt || "Picture"} className="grid h-28 w-44 place-items-center rounded border border-dashed bg-muted/50 text-muted-foreground">
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  if (b.type === "POOL")
    return (
      <div className="grid gap-x-6 gap-y-1 rounded border bg-muted/30 p-3 sm:grid-cols-2">
        {b.entries!.map((e) => (
          <div key={e.id} className="text-[15px]"><span className="mr-1.5 font-sans font-semibold text-primary">{e.letter}.</span>{e.text}</div>
        ))}
      </div>
    );
  return (
    <div className="rounded border bg-muted/20 p-4">
      <h4 className="mb-1 text-center font-semibold">{b.title}</h4>
      <p className="text-[15px] leading-8"><RichText text={b.text ?? ""} renderBlank={(n) => <BlankChip n={n} />} /></p>
    </div>
  );
}

export function StudentPreview() {
  const a = useBuilder((s) => s.assignment);
  const set = useBuilder((s) => s.set);
  const view = useMemo(() => buildStudentView(a), [a]);
  const [answers, setAnswers] = useState<Answers>({});
  const [showPoints, setShowPoints] = useState(a.settings.showPoints);
  const setAnswer = (id: string, v: Answers[string]) => setAnswers((s) => ({ ...s, [id]: v }));
  const answered = Object.keys(answers).length;

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
        <article className="mx-auto max-w-[820px] rounded-lg border bg-paper font-serif shadow-sm">
          <header className="border-b px-10 py-6">
            <div className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">English · Grade {view.grade}</div>
            <h1 className="mt-1 text-2xl font-bold">{view.title}</h1>
            {view.instructions && <p className="mt-2 italic text-muted-foreground">{view.instructions}</p>}
            <div className="mt-3 flex gap-5 font-sans text-xs text-muted-foreground">
              <span>{view.totalQuestions} questions</span>
              {showPoints && <span>{view.totalPoints} points</span>}
              {view.timeLimitMin ? <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {view.timeLimitMin} minutes</span> : null}
            </div>
          </header>
          <div className="space-y-8 px-10 py-6">
            {view.sections.map((s) => (
              <section key={s.id}>
                <h2 className="text-lg font-bold">{s.titleEn}</h2>
                {s.titleVi && <div className="font-sans text-xs text-muted-foreground">{s.titleVi}</div>}
                {s.instructionsEn && <p className="mt-1 italic">{s.instructionsEn}</p>}
                {s.instructionsVi && <p className="font-sans text-xs italic text-muted-foreground">{s.instructionsVi}</p>}
                <div className="mt-3 space-y-2">
                  {s.units.map((u) =>
                    u.kind === "question" ? (
                      <QuestionView key={u.q.id} q={u.q} answers={answers} setAnswer={setAnswer} showPoints={showPoints} />
                    ) : (
                      <div key={u.block.id} className="space-y-1 py-2">
                        <BlockView b={u.block} />
                        <div className="pl-2">
                          {u.members.map((q) => <QuestionView key={q.id} q={q} answers={answers} setAnswer={setAnswer} showPoints={showPoints} />)}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            ))}
            <div className="flex justify-center border-t pt-6 font-sans">
              <Button disabled title="Submitting is disabled in preview">Submit (disabled in preview)</Button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
