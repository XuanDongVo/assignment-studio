import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isQuestionTool } from "../ops";
import { useBuilder } from "../store";
import type { InsertTarget, ToolKey } from "../types";
import { TOOLS } from "./Toolbox";



/** Pick a question type once, pick how many, insert them in a row. */
export function BatchAdd({ target, label = "Add questions", variant = "outline" }: { target?: InsertTarget | null; label?: string; variant?: "outline" | "ghost" | "default" }) {
  const addTool = useBuilder((s) => s.addTool);
  const QTOOLS = TOOLS.filter((t) => isQuestionTool(t.key));
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<ToolKey>("SINGLE_CHOICE");
  const [count, setCount] = useState(5);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant} onClick={(e) => e.stopPropagation()}>
          <Layers className="h-4 w-4" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-medium">Add several questions</div>
        <div className="grid grid-cols-2 gap-1">
          {QTOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs ${tool === t.key ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"}`}
            >
              <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[1, 3, 5, 10].map((n) => (
            <Button key={n} size="sm" variant={count === n ? "default" : "outline"} className="h-7 px-2" onClick={() => setCount(n)}>
              {n}
            </Button>
          ))}
          <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-7 w-16" aria-label="Number of questions" />
        </div>
        <p className="text-xs text-muted-foreground">Inserted after the selected item, or at the end of the section. New questions are empty drafts — no answers are filled in for you.</p>
        <Button
          size="sm"
          className="w-full"
          disabled={!(count >= 1 && count <= 50)}
          onClick={() => {
            addTool(tool, target ?? null, count);
            setOpen(false);
          }}
        >
          <Plus className="h-4 w-4" /> Add {count} question{count === 1 ? "" : "s"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
