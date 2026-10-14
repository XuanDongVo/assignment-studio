import { useDraggable } from "@dnd-kit/core";
import {
  AlignLeft,
  BookOpen,
  CircleDot,
  Image as ImageIcon,
  LayoutList,
  Link2,
  ListChecks,
  Rows3,
  SquareCheck,
  TextCursorInput,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import { useBuilder } from "../store";
import type { ToolKey } from "../types";

export const TOOLS: { key: ToolKey; label: string; desc: string; icon: LucideIcon; group: string }[] = [
  { key: "SINGLE_CHOICE", label: "Single choice", desc: "One correct option (A–D)", icon: CircleDot, group: "Questions" },
  { key: "TRUE_FALSE", label: "True / False", desc: "Two-option statement check", icon: ToggleLeft, group: "Questions" },
  { key: "MULTIPLE_CHOICE", label: "Multiple choice", desc: "Several correct options", icon: SquareCheck, group: "Questions" },
  { key: "TEXT_INPUT", label: "Text input", desc: "Short typed answer, prefix & cue", icon: TextCursorInput, group: "Questions" },
  { key: "MULTI_BLANKS", label: "Multiple blanks", desc: "Several gaps in one sentence", icon: Rows3, group: "Questions" },
  { key: "MATCHING", label: "Matching", desc: "Pick a letter from an answer pool", icon: Link2, group: "Questions" },
  { key: "SECTION", label: "Section", desc: "Numbered part with EN/VI title", icon: LayoutList, group: "Structure" },
  { key: "INSTRUCTIONS", label: "Instructions", desc: "Text shown to students", icon: AlignLeft, group: "Shared content" },
  { key: "PASSAGE", label: "Reading passage", desc: "Text or cloze with {{1}} blanks", icon: BookOpen, group: "Shared content" },
  { key: "MEDIA", label: "Image", desc: "Picture with alt text & caption", icon: ImageIcon, group: "Shared content" },
  { key: "POOL", label: "Answer pool", desc: "Lettered list A, B, C… for matching", icon: ListChecks, group: "Shared content" },
];

function ToolButton({ t }: { t: (typeof TOOLS)[number] }) {
  const addTool = useBuilder((s) => s.addTool);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `t:${t.key}` });
  const Icon = t.icon;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => addTool(t.key)}
      className={`flex w-full items-start gap-3 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-card ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{t.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{t.desc}</span>
      </span>
    </button>
  );
}

export function Toolbox() {
  const groups = [...new Set(TOOLS.map((t) => t.group))];
  return (
    <div className="space-y-4 p-3">
      <p className="px-1 text-xs text-muted-foreground">Click to add after the selected item, or drag onto the page.</p>
      {groups.map((g) => (
        <div key={g} data-tour={g === "Structure" ? "toolbox-structure" : g === "Shared content" ? "toolbox-shared" : undefined}>
          <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
          <div className="space-y-0.5">
            {TOOLS.filter((t) => t.group === g).map((t) => (
              <ToolButton key={t.key} t={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
