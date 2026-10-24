import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { uid } from "../ops";
import { localRepository } from "../save-service";
import { useBuilder } from "../store";

/** Shown when students have started: question content is frozen, settings stay editable. */
export function ContentLockBanner() {
  const count = useBuilder((s) => s.startedCount);
  const navigate = useNavigate();

  // A student may start while this page is open (other tab): refresh the lock.
  useEffect(() => {
    const refresh = () => useBuilder.getState().refreshLock();
    const onStorage = (e: StorageEvent) => e.key === "ab.attempts.db.v1" && refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!count) return null;
  const duplicate = async () => {
    const a = useBuilder.getState().assignment;
    const copy = { ...structuredClone(a), id: uid("asg"), title: `${a.title} (copy)`, status: "draft" as const, publishedAt: null };
    await localRepository.save(copy);
    toast.success("Đã nhân bản — mở bản sao để sửa");
    navigate({ to: "/", search: { id: copy.id } });
  };
  return (
    <div className="flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-sm text-warning-foreground">
      <Lock className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <b>Nội dung đề đã khóa</b> — {count} học sinh đã bắt đầu làm bài. Vẫn đổi được tên bài, hạn nộp, lớp và cài đặt hiển thị.
      </span>
      <button onClick={duplicate} className="shrink-0 text-xs font-semibold underline">Nhân bản để sửa</button>
    </div>
  );
}
