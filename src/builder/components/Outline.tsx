// @ts-nocheck -- prototype: strict index-access checks relaxed
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import * as ops from "../ops";
import { useBuilder } from "../store";
import type { BlockItem, ID, Item, Section } from "../types";
import { useIssues, useNumbering } from "./Canvas";

function itemLabel(it: Item, num?: number) {
  if (it.kind === "block") return ops.blockLabel(it);
  const c = it.content;
  const head = it.config.isExample ? "Example" : `Câu ${num}`;
  const text = c.prompt ? ops.plainText(c.prompt) : c.blankRef ? `Blank (${c.blankRef})` : "options" in c ? c.options.map((o) => ops.plainText(o.text)).join(" / ") : "(empty)";
  return `${head} · ${text}`;
}

function Rename({ value, onDone }: { value: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onDone(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v);
        if (e.key === "Escape") onDone(null);
      }}
      className="h-6 w-full min-w-0 rounded border border-primary bg-card px-1 text-sm outline-none"
    />
  );
}

function Row({ id, depth, children, actions, selected, onSelect }: { id: string; depth: number; children: ReactNode; actions?: ReactNode; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, paddingLeft: depth * 14 + 4 }}
      onClick={onSelect}
      className={cn("group/row flex h-8 cursor-pointer items-center gap-1 rounded pr-1 text-sm", selected ? "bg-primary/10 text-primary" : "hover:bg-muted", isDragging && "opacity-50")}
    >
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Drag" className="shrink-0 cursor-grab text-muted-foreground/40 hover:text-muted-foreground" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1 truncate">{children}</div>
      <div className="hidden shrink-0 items-center group-hover/row:flex">{actions}</div>
    </div>
  );
}

const iconBtn = "grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground";

function ItemRow({ id, depth }: { id: ID; depth: number }) {
  const a = useBuilder((s) => s.assignment);
  const selection = useBuilder((s) => s.selection);
  const { select, requestDeleteItem, mutate } = useBuilder.getState();
  const { numbers } = useNumbering();
  const errs = useIssues().some((i) => i.target.id === id && i.level === "error");
  const [renaming, setRenaming] = useState(false);
  const [open, setOpen] = useState(true);
  const it = a.items[id];
  const { setNodeRef } = useDroppable({ id: `og:${id}`, disabled: it?.kind !== "block" });
  if (!it) return null;
  const renamable = it.kind === "block" && (it.block.type === "PASSAGE" || it.block.type === "POOL");
  return (
    <div>
      <Row
        id={`o:${id}`}
        depth={depth}
        selected={selection?.id === id}
        onSelect={() => {
          select({ kind: "item", id });
          document.getElementById(`item-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
        actions={
          <>
            {renamable && (
              <button className={iconBtn} aria-label="Rename" onClick={(e) => (e.stopPropagation(), setRenaming(true))}>
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button className={iconBtn} aria-label="Delete" onClick={(e) => (e.stopPropagation(), requestDeleteItem(id))}>
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        }
      >
        <span className="flex items-center gap-1">
          {it.kind === "block" && (
            <button aria-label="Toggle" onClick={(e) => (e.stopPropagation(), setOpen(!open))} className="shrink-0">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
            </button>
          )}
          {errs && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
          {renaming ? (
            <Rename
              value={ops.blockLabel(it as BlockItem)}
              onDone={(v) => {
                setRenaming(false);
                if (v != null)
                  mutate((d) => {
                    const b = (d.items[id] as BlockItem).block;
                    if (b.type === "PASSAGE" || b.type === "POOL") b.title = v;
                  });
              }}
            />
          ) : (
            <span className={cn("truncate", it.kind === "block" && "font-medium")}>
              {itemLabel(it, numbers.get(id))}
              {it.kind === "block" && <span className="ml-1 text-xs text-muted-foreground">· {it.memberIds.length}</span>}
            </span>
          )}
        </span>
      </Row>
      {it.kind === "block" && open && (
        <div ref={setNodeRef}>
          <SortableContext items={it.memberIds.map((m) => `o:${m}`)} strategy={verticalListSortingStrategy}>
            {it.memberIds.map((m) => (
              <ItemRow key={m} id={m} depth={depth + 1} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function SectionNode({ s, index, count }: { s: Section; index: number; count: number }) {
  const selection = useBuilder((st) => st.selection);
  const { select, mutate, requestDeleteSection } = useBuilder.getState();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `os:${s.id}` });
  const moveSection = (delta: number) =>
    mutate((d) => {
      const i = d.sections.findIndex((x) => x.id === s.id);
      const j = i + delta;
      if (j < 0 || j >= d.sections.length) return;
      [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
    });
  return (
    <div className={cn("rounded", isOver && "bg-primary/5")} ref={setNodeRef}>
      <div
        onClick={() => {
          select({ kind: "section", id: s.id });
          document.getElementById(`section-${s.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
        }}
        className={cn("group/row flex h-8 cursor-pointer items-center gap-1 rounded px-1 text-sm font-semibold", selection?.id === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}
      >
        <button aria-label={open ? "Collapse" : "Expand"} onClick={(e) => (e.stopPropagation(), setOpen(!open))} className="shrink-0">
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </button>
        <div className="min-w-0 flex-1 truncate">
          {renaming ? (
            <Rename
              value={s.titleEn}
              onDone={(v) => {
                setRenaming(false);
                if (v != null) mutate((d) => (d.sections.find((x) => x.id === s.id)!.titleEn = v));
              }}
            />
          ) : (
            s.titleEn || <span className="italic text-destructive">Untitled section</span>
          )}
        </div>
        <div className="hidden shrink-0 items-center group-hover/row:flex">
          <button className={iconBtn} aria-label="Move section up" disabled={index === 0} onClick={(e) => (e.stopPropagation(), moveSection(-1))}>
            <ArrowUp className="h-3 w-3" />
          </button>
          <button className={iconBtn} aria-label="Move section down" disabled={index === count - 1} onClick={(e) => (e.stopPropagation(), moveSection(1))}>
            <ArrowDown className="h-3 w-3" />
          </button>
          <button className={iconBtn} aria-label="Rename section" onClick={(e) => (e.stopPropagation(), setRenaming(true))}>
            <Pencil className="h-3 w-3" />
          </button>
          <button className={iconBtn} aria-label="Delete section" onClick={(e) => (e.stopPropagation(), requestDeleteSection(s.id))}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {open && (
        <SortableContext items={s.itemIds.map((id) => `o:${id}`)} strategy={verticalListSortingStrategy}>
          {s.itemIds.map((id) => (
            <ItemRow key={id} id={id} depth={1} />
          ))}
          {s.itemIds.length === 0 && <div className="py-1 pl-8 text-xs text-muted-foreground">Empty — drop items here</div>}
        </SortableContext>
      )}
    </div>
  );
}

export function Outline() {
  const sections = useBuilder((s) => s.assignment.sections);
  return (
    <div className="space-y-1 p-2">
      {sections.map((s, i) => (
        <SectionNode key={s.id} s={s} index={i} count={sections.length} />
      ))}
      {sections.length === 0 && <p className="p-3 text-sm text-muted-foreground">No sections yet.</p>}
    </div>
  );
}
