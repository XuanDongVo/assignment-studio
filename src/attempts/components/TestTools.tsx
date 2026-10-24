import { FlaskConical } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { advanceServerClock, currentStudentId, getNet, resetAttemptForTesting, resetServerClock, setNet, subscribeNet } from "../api";

const serverSnapshot = () => '{"offline":false,"dropNextResponse":false,"failNextGrading":false}';

/** Prototype-only switches to try the hard cases (offline, lost reply, grading crash, time-out). */
export function TestTools({ assignmentId, onClock, onReset }: { assignmentId?: string; onClock?: () => void; onReset?: () => void }) {
  const raw = useSyncExternalStore(subscribeNet, () => JSON.stringify(getNet()), serverSnapshot);
  const net = JSON.parse(raw) as ReturnType<typeof getNet>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="fixed bottom-3 left-3 z-[70] bg-card shadow-sm">
          <FlaskConical className="h-4 w-4" /> Thử nghiệm{net.offline ? " · mất mạng" : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="z-[80] w-80 space-y-3 text-sm">
        <div>
          <div className="font-semibold">Công cụ thử nghiệm</div>
          <p className="text-xs text-muted-foreground">Chỉ có trong bản mẫu, để thử các tình huống khó. Học sinh thật không thấy.</p>
        </div>
        <label className="flex items-center justify-between gap-2">
          Mất mạng <Switch checked={net.offline} onCheckedChange={(v) => setNet({ offline: v })} />
        </label>
        <div className="grid gap-1.5">
          <Button size="sm" variant="secondary" disabled={net.dropNextResponse} onClick={() => setNet({ dropNextResponse: true })}>
            {net.dropNextResponse ? "Đã bật: mất phản hồi lần gửi tới" : "Máy chủ lưu nhưng mất phản hồi (1 lần)"}
          </Button>
          <Button size="sm" variant="secondary" disabled={net.failNextGrading} onClick={() => setNet({ failNextGrading: true })}>
            {net.failNextGrading ? "Đã bật: lỗi chấm điểm lần tới" : "Lỗi khi chấm điểm (1 lần)"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => (advanceServerClock(5), toast("Đồng hồ máy chủ +5 phút"), onClock?.())}>Tua đồng hồ máy chủ +5 phút</Button>
          <Button size="sm" variant="ghost" onClick={() => (resetServerClock(), toast("Đồng hồ máy chủ về giờ thật"), onClock?.())}>Đặt lại đồng hồ</Button>
          {assignmentId && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                const sid = currentStudentId();
                if (!sid) return;
                resetAttemptForTesting(assignmentId, sid);
                toast("Đã xoá lượt làm của học sinh này");
                onReset?.();
              }}
            >
              Xoá lượt làm để thử lại từ đầu
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
