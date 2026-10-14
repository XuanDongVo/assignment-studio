import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilder } from "../store";

const SEEN_KEY = "ab.tour.seen.v1";
export const openTour = () => window.dispatchEvent(new Event("ab:tour"));

type Step = { target: string; title: string; body: string };
const STEPS: Step[] = [
  { target: "header", title: "1. Thanh điều khiển", body: "Sửa tên bài, xem trạng thái lưu, chuyển Edit / Student Preview, mở Settings (thời gian, lớp, hạn nộp) và bấm Save Draft (Ctrl+S)." },
  { target: "toolbox-structure", title: "2. Cấu trúc: tạo Section trước", body: "Đề thi gồm nhiều Section (Phần I, II, III…). Mọi câu hỏi và nội dung đều phải nằm trong một Section, nên hãy thêm Section trước tiên. Section có tiêu đề song ngữ Anh – Việt và hướng dẫn làm bài riêng." },
  { target: "toolbox-shared", title: "3. Nội dung dùng chung (Shared content)", body: "Reading Passage, Answer Pool, Image, Instructions là các khối dùng chung: một khối sở hữu nhiều câu hỏi con, không cần tạo lại cho từng câu. Ví dụ: bài đọc có chỗ trống {{1}}, {{2}}… mỗi chỗ trống là một câu hỏi; Answer Pool A–H dùng cho nhiều câu nối (Matching). Xóa khối sẽ được hỏi 'xóa cả câu hỏi con' hay 'tách nhóm'." },
  { target: "toolbox", title: "4. Kéo – thả hoặc click", body: "Nhấn giữ một thẻ rồi kéo vào trang giữa: thả vào Section để thêm cuối Section, thả lên khung bài đọc / pool để thành câu hỏi của nhóm đó (khối dùng chung di chuyển cả nhóm như một khối). Hoặc chọn một câu rồi click thẻ: mục mới chèn ngay sau câu đang chọn." },
  { target: "canvas", title: "5. Trang soạn đề", body: "Mỗi câu có tay cầm kéo, mũi tên ↑↓, menu Duplicate / Delete / Add before–after. Số thứ tự 'Câu n' tự đánh. Click chip {{1}} trong bài đọc để mở câu tương ứng, hoặc bấm 'Create questions for all blanks' để tạo câu cho mọi chỗ trống." },
  { target: "properties", title: "6. Cột thuộc tính", body: "Click bất kỳ Section, câu hỏi hay khối nào để sửa ở đây: đề bài, đáp án đúng, điểm, câu mẫu (Example), gắn / tách câu hỏi khỏi nhóm dùng chung." },
  { target: "validation", title: "7. Kiểm tra lỗi", body: "Lỗi và cảnh báo cập nhật trực tiếp, bấm 'Go to item' để tới chỗ cần sửa. Có thể lưu nháp khi còn lỗi; chỉ 'Ready to publish' khi không còn lỗi. Tab Outline (cột trái) cho xem cấu trúc dạng cây." },
];

export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const setB = useBuilder((s: any) => s.set);
  const demoIds = useRef<{ kind: "item" | "section"; id: string }[]>([]);

  const cleanupDemo = useCallback(() => {
    const st = useBuilder.getState() as any;
    const ids = demoIds.current.splice(0).reverse();
    if (!ids.length) return;
    st.mutate((d: any) => {
      for (const x of ids) {
        if (x.kind === "section") { if (d.sections.some((s: any) => s.id === x.id)) ops.removeSection(d, x.id); }
        else if (d.items[x.id]) ops.removeItem(d, x.id, true);
      }
    });
    st.select(null);
  }, []);

  const start = useCallback(() => { setB?.({ mode: "edit" }); setStep(0); }, [setB]);
  const close = useCallback(() => { cleanupDemo(); setStep(null); localStorage.setItem(SEEN_KEY, "1"); }, [cleanupDemo]);

  // Live demo: step 2 adds a sample Section, step 3 adds a sample Reading Passage
  useEffect(() => {
    if (step === null) return;
    cleanupDemo();
    const demo = step === 1 ? "SECTION" : step === 2 ? "PASSAGE" : null;
    if (!demo) return;
    const st = useBuilder.getState() as any;
    st.addTool(demo);
    const sel = useBuilder.getState().selection as any;
    if (sel) demoIds.current.push({ kind: sel.kind, id: sel.id });
    if (demo === "PASSAGE") {
      st.mutate((d: any) => {
        const b = d.items[sel.id];
        if (b?.block.type === "PASSAGE") {
          b.block.title = "My School (mẫu)";
          b.block.text = "This is my school. It has {{1}} floors and a big {{2}}. We study English in room {{3}}.";
        }
      });
    }
    return cleanupDemo;
  }, [step, cleanupDemo]);

  useEffect(() => {
    window.addEventListener("ab:tour", start);
    if (!localStorage.getItem(SEEN_KEY)) setTimeout(start, 800);
    return () => window.removeEventListener("ab:tour", start);
  }, [start]);

  useLayoutEffect(() => {
    if (step === null) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${STEPS[step]!.target}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const t = setTimeout(measure, 150);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [step]);

  useEffect(() => {
    if (step === null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep((s) => (s! < STEPS.length - 1 ? s! + 1 : s));
      if (e.key === "ArrowLeft") setStep((s) => (s! > 0 ? s! - 1 : s));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [step, close]);

  if (step === null) return null;
  const s = STEPS[step]!;
  const W = 340, pad = 12, vw = window.innerWidth, vh = window.innerHeight;
  let pos: React.CSSProperties = { left: vw / 2 - W / 2, top: vh / 2 - 100 };
  if (rect) {
    if (rect.right + W + pad < vw) pos = { left: rect.right + pad, top: Math.min(Math.max(rect.top + 20, pad), vh - 260) };
    else if (rect.left - W - pad > 0) pos = { left: rect.left - W - pad, top: Math.min(Math.max(rect.top + 20, pad), vh - 260) };
    else if (rect.bottom + 240 < vh) pos = { left: Math.min(Math.max(rect.left, pad), vw - W - pad), top: rect.bottom + pad };
    else pos = { left: Math.min(Math.max(rect.left, pad), vw - W - pad), top: Math.max(rect.top - 250, pad) };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Hướng dẫn sử dụng">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: "0 0 0 9999px color-mix(in oklab, var(--foreground) 45%, transparent)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/45" />
      )}
      <div className="absolute rounded-lg border bg-card p-4 shadow-xl" style={{ ...pos, width: W }}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-semibold">{s.title}</h3>
          <button aria-label="Đóng hướng dẫn" onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-3 flex gap-1">
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />)}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={close}>Bỏ qua</Button>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Trước</Button>
            {step < STEPS.length - 1
              ? <Button size="sm" onClick={() => setStep(step + 1)}>Tiếp theo</Button>
              : <Button size="sm" onClick={close}>Hoàn tất</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
