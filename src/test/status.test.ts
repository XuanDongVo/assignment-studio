import { describe, expect, it } from "vitest";
import { canMoveTo, statusOf, withStatus } from "@/builder/status";
import { createSeed } from "@/builder/seed";

describe("assignment status rules", () => {
  it("older assignments without a status count as drafts", () => {
    const a = createSeed();
    delete a.status;
    expect(statusOf(a)).toBe("draft");
  });

  it("cannot publish while there are errors", () => {
    expect(canMoveTo("published", 2).ok).toBe(false);
    expect(canMoveTo("published", 0).ok).toBe(true);
  });

  it("draft and archived are allowed even with errors", () => {
    expect(canMoveTo("draft", 5).ok).toBe(true);
    expect(canMoveTo("archived", 5).ok).toBe(true);
  });

  it("keeps the first publish date when re-published or archived", () => {
    const a = withStatus(createSeed(), "published", "2026-10-01T00:00:00.000Z");
    expect(a.publishedAt).toBe("2026-10-01T00:00:00.000Z");
    const archived = withStatus(a, "archived", "2026-10-05T00:00:00.000Z");
    expect(archived.status).toBe("archived");
    expect(withStatus(archived, "published", "2026-10-09T00:00:00.000Z").publishedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});
