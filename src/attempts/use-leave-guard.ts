import { useCallback, useEffect, useRef, useState } from "react";

export function useLeaveGuard(enabled: boolean, attemptId: string | undefined) {
  const [away, setAway] = useState(false);
  const [count, setCount] = useState(0);
  const latched = useRef(false);
  const unsafe = useCallback(
    () =>
      document.hidden ||
      !document.hasFocus() ||
      (document.fullscreenEnabled && !document.fullscreenElement),
    [],
  );
  useEffect(() => {
    latched.current = false;
    setAway(false);
    setCount(0);
  }, [attemptId]);
  useEffect(() => {
    if (!enabled) {
      latched.current = false;
      setAway(false);
      return;
    }
    const check = () => {
      if (!unsafe() || latched.current) return;
      latched.current = true;
      setCount((n) => n + 1);
      setAway(true);
    };
    const t = setTimeout(check, 900);
    document.addEventListener("fullscreenchange", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", check);
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("blur", check);
      document.removeEventListener("contextmenu", block);
    };
  }, [enabled, unsafe, attemptId]);
  const acknowledge = useCallback(async () => {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      window.focus();
      if (unsafe()) return;
      latched.current = false;
      setAway(false);
    } catch {
      /* Keep warning open when fullscreen is denied. */
    }
  }, [unsafe]);
  return { away, count, acknowledge };
}
