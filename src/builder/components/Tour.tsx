import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilder } from "../store";

const SEEN_KEY = "ab.tour.seen.v1";
export const openTour = () => window.dispatchEvent(new Event("ab:tour"));

type Step = { target: string; title: string; body: string };
const STEPS: Step[] = [
  { target: "header", title: "1. Thanh điều khiển", body: "Sửa tên bài, xem trạng thái lưu, chuyển Edit / Student Preview, mở Settings (thời gian, lớp, hạn nộp) và bấm Save Draft (Ctrl+S)." },
  { target: "toolbox", title: "2. Tạo Section trước", body: "Mọi nội dung đều nằm trong một Section. Hãy thêm Section trước, sau đó thêm nội dung dùng chung (Reading Passage, Answer Pool, Image) và câu hỏi." },
  { target: "toolbox", title: "3. Kéo – thả hoặc click", body: "Nhấn giữ một thẻ rồi kéo vào trang giữa: thả vào Section để thêm cuối Section, thả lên khung bài đọc / pool để thành câu hỏi của nhóm đó. Hoặc chọn một câu rồi click thẻ: mục mới chèn ngay sau câu đang chọn." },
  { target: "canvas", title: "4. Trang soạn đề", body: "Mỗi câu có tay cầm kéo, mũi tên ↑↓, menu Duplicate / Delete / Add before–after. Số thứ tự 'Câu n' tự đánh. Click chip {{1}} trong bài đọc để mở câu tương ứng." },
  { target: "properties", title: "5. Cột thuộc tính", body: "Click bất kỳ Section, câu hỏi hay khối nào để sửa ở đây: đề bài, đáp án đúng, điểm, câu mẫu (Example), gắn / tách khỏi nhóm." },
  { target: "validation", title: "6. Kiểm tra lỗi", body: "Lỗi và cảnh báo cập nhật trực tiếp, bấm 'Go to item' để tới chỗ cần sửa. Có thể lưu nháp khi còn lỗi; chỉ 'Ready to publish' khi không còn lỗi. Tab Outline (cột trái) cho xem cấu trúc dạng cây." },
];

export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const setB = useBuilder((s: any) => s.set);

  const start = useCallback(() => { setB?.({ mode: "edit" }); setStep(0); }, [setB]);
  const close = useCallback(() => { setStep(null); localStorage.setItem(SEEN_KEY, "1"); }, []);

  useEffect(() => {
    window.addEventListener("ab:tour", start);
    if (!localStorage.getItem(SEEN_KEY)) setTimeout(start, 800);
    return () => window.removeEventListener("ab:tour", start);
  }, [start]);

  useLayoutEffect(() => {
    if (step === null) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${STEPS[step]!.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
