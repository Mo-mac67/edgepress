import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-nl-"));
  process.env.ADMIN_SECRET = "test-secret";
});

import { getSubscribers, isValidUnsubscribe, subscribe, unsubscribe, unsubscribeToken } from "@/lib/newsletter-store";

describe("newsletter store (fs adapter)", () => {
  it("validates and normalizes emails", async () => {
    expect(await subscribe("not-an-email")).toHaveProperty("error");
    const s = await subscribe("  Reader@Example.COM ");
    expect("error" in s).toBe(false);
    if (!("error" in s)) expect(s.email).toBe("reader@example.com");
  });

  it("is idempotent — double signup never duplicates", async () => {
    await subscribe("dupe@example.com");
    await subscribe("DUPE@example.com");
    const subs = await getSubscribers();
    expect(subs.filter((s) => s.email === "dupe@example.com").length).toBe(1);
  });

  it("concurrent signups never lose one (append-log)", async () => {
    await Promise.all([...Array(10)].map((_, i) => subscribe(`racer${i}@example.com`)));
    const subs = await getSubscribers();
    expect(subs.filter((s) => s.email.startsWith("racer")).length).toBe(10);
  });

  it("unsubscribe links are signed per email", () => {
    const t = unsubscribeToken("reader@example.com");
    expect(isValidUnsubscribe("reader@example.com", t)).toBe(true);
    expect(isValidUnsubscribe("other@example.com", t)).toBe(false);
    expect(isValidUnsubscribe("reader@example.com", "forged")).toBe(false);
  });

  it("unsubscribe removes the address", async () => {
    await subscribe("leaver@example.com");
    expect(await unsubscribe("leaver@example.com")).toBe(true);
    expect((await getSubscribers()).some((s) => s.email === "leaver@example.com")).toBe(false);
    expect(await unsubscribe("leaver@example.com")).toBe(false);
  });
});
