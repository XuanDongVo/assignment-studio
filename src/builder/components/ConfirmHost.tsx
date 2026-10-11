import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBuilder } from "../store";

export function ConfirmHost() {
  const c = useBuilder((s) => s.confirm);
  const close = () => useBuilder.getState().set({ confirm: null });
  return (
    <AlertDialog open={!!c} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{c?.title}</AlertDialogTitle>
          <AlertDialogDescription>{c?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {c?.actions.map((a) => (
            <Button key={a.label} variant={a.variant ?? "default"} onClick={() => (close(), a.run())}>
              {a.label}
            </Button>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
