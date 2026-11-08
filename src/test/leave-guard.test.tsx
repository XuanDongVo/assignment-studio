import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLeaveGuard } from "@/attempts/use-leave-guard";

afterEach(() => {
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(window, "focus").mockImplementation(() => {});
});
it("keeps the warning open on focus until the student acknowledges it", async () => {
  let focused = true;
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  const { result } = renderHook(() => useLeaveGuard(true, "attempt-1"));
  act(() => {
    focused = false;
    window.dispatchEvent(new Event("blur"));
  });
  expect(result.current.away).toBe(true);
  act(() => {
    focused = true;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.away).toBe(true);
  expect(result.current.count).toBe(1);
  await act(async () => {
    await result.current.acknowledge();
  });
  expect(result.current.away).toBe(false);
  act(() => {
    focused = false;
    window.dispatchEvent(new Event("blur"));
  });
  expect(result.current.count).toBe(2);
});
it("does not unlock while the browser is still unsafe", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  const { result, rerender } = renderHook(({ id }) => useLeaveGuard(true, id), {
    initialProps: { id: "one" },
  });
  act(() => window.dispatchEvent(new Event("blur")));
  await act(async () => {
    await result.current.acknowledge();
  });
  expect(result.current.away).toBe(true);
  rerender({ id: "two" });
  expect(result.current.count).toBe(0);
});
