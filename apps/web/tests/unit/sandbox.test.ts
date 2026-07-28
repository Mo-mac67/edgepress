import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Sandbox mode's whole job is to be OFF for normal installs and to contain a
 * stranger when it's on. Both halves are worth pinning down: a guard that
 * leaks on a real site is worse than no guard at all.
 */

const load = async () => import("@/lib/sandbox");

describe("sandbox mode", () => {
  const original = process.env.EDGEPRESS_SANDBOX;
  afterEach(() => {
    if (original === undefined) delete process.env.EDGEPRESS_SANDBOX;
    else process.env.EDGEPRESS_SANDBOX = original;
  });

  it("is off unless explicitly enabled", async () => {
    const { isSandbox, sandboxBlocks } = await load();
    for (const value of [undefined, "", "0", "false", "true", "yes"]) {
      if (value === undefined) delete process.env.EDGEPRESS_SANDBOX;
      else process.env.EDGEPRESS_SANDBOX = value;
      // Only the exact string "1" turns it on — no truthy-string surprises.
      const expected = value === "1";
      expect(isSandbox(), `EDGEPRESS_SANDBOX=${String(value)}`).toBe(expected);
      expect(sandboxBlocks("send-email")).toBe(expected);
    }
  });

  it("blocks every containment action when on, and none when off", async () => {
    const { sandboxBlocks, sandboxReason } = await load();
    const actions = [
      "send-email", "deliver-webhook", "change-password", "change-admin-path",
      "change-owner-username", "logout-everywhere", "manage-2fa", "restore-backup",
    ] as const;

    process.env.EDGEPRESS_SANDBOX = "1";
    for (const a of actions) {
      expect(sandboxBlocks(a), `${a} should be blocked`).toBe(true);
      expect(sandboxReason(a), `${a} needs a reason to show the user`).toBeTruthy();
    }

    delete process.env.EDGEPRESS_SANDBOX;
    for (const a of actions) expect(sandboxBlocks(a), `${a} must be allowed off-sandbox`).toBe(false);
  });

  it("withholds the email key only in sandbox", async () => {
    const { emailApiKey } = await import("@/lib/outbound");
    const originalKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_key";

    delete process.env.EDGEPRESS_SANDBOX;
    expect(emailApiKey()).toBe("re_test_key");

    process.env.EDGEPRESS_SANDBOX = "1";
    // Senders already no-op without a key, so this reuses their safe path.
    expect(emailApiKey()).toBeUndefined();

    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("reports a sane reset interval", async () => {
    const { sandboxResetMinutes } = await load();
    const originalMin = process.env.EDGEPRESS_SANDBOX_RESET_MINUTES;
    for (const [set, expected] of [[undefined, 60], ["30", 30], ["0", 60], ["-5", 60], ["abc", 60]] as const) {
      if (set === undefined) delete process.env.EDGEPRESS_SANDBOX_RESET_MINUTES;
      else process.env.EDGEPRESS_SANDBOX_RESET_MINUTES = set;
      expect(sandboxResetMinutes(), `value ${String(set)}`).toBe(expected);
    }
    if (originalMin === undefined) delete process.env.EDGEPRESS_SANDBOX_RESET_MINUTES;
    else process.env.EDGEPRESS_SANDBOX_RESET_MINUTES = originalMin;
  });
});

describe("sandbox reset", () => {
  const dir = `.tmp-sandbox-${process.pid}`;
  beforeEach(() => {
    process.env.EDGEPRESS_STORAGE = "fs";
    process.env.DATA_DIR = dir;
    process.env.EDGEPRESS_SANDBOX = "1";
  });
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
    delete process.env.EDGEPRESS_SANDBOX;
  });

  it("does nothing when there is no snapshot — never wipes to empty", async () => {
    const { resetSandbox, hasSnapshot } = await import("@/lib/sandbox");
    expect(await hasSnapshot()).toBe(false);
    // The dangerous failure mode would be "restore nothing" = delete everything.
    expect(await resetSandbox()).toBeNull();
  });

  it("read-time reset waits for the interval, then fires", async () => {
    const { captureSnapshot, maybeResetSandbox, getSandboxState } = await import("@/lib/sandbox");
    const { getPages, savePage } = await import("@/lib/cms-store");
    const { writeJsonDoc } = await import("@/lib/storage");
    process.env.EDGEPRESS_SANDBOX_RESET_MINUTES = "60";

    // Snapshot a sandbox that HAS content, the way a real one is set up.
    await savePage({ id: "seed-welcome", slug: "welcome", status: "published", title: { en: "W", fr: "W" }, description: { en: "", fr: "" }, blocks: [] } as never);
    await captureSnapshot();
    await savePage({ id: "junk-1", slug: "junk", status: "published", title: { en: "J", fr: "J" }, description: { en: "", fr: "" }, blocks: [] } as never);

    // Just reset → not due yet, the visitor's page must survive.
    await writeJsonDoc("sandbox-state.json", { lastResetAt: new Date().toISOString() });
    expect(await maybeResetSandbox()).toBe(false);
    expect((await getPages()).some((p) => p.slug === "junk")).toBe(true);

    // Interval elapsed → it fires and the page is gone.
    await writeJsonDoc("sandbox-state.json", { lastResetAt: new Date(Date.now() - 61 * 60_000).toISOString() });
    expect(await maybeResetSandbox()).toBe(true);
    expect((await getPages()).some((p) => p.slug === "junk")).toBe(false);

    delete process.env.EDGEPRESS_SANDBOX_RESET_MINUTES;
  });

  it("read-time reset does nothing on a non-sandbox site", async () => {
    const { captureSnapshot, maybeResetSandbox } = await import("@/lib/sandbox");
    await captureSnapshot();
    delete process.env.EDGEPRESS_SANDBOX;
    // Runs on every page render, so this is the assertion that keeps it from
    // ever touching a real site's content.
    expect(await maybeResetSandbox()).toBe(false);
  });

  it("captures a snapshot and restores content back to it", async () => {
    const { captureSnapshot, resetSandbox, hasSnapshot, getSandboxState } = await import("@/lib/sandbox");
    const { getPages, savePage } = await import("@/lib/cms-store");

    await savePage({ id: "seed-welcome", slug: "welcome", status: "published", title: { en: "W", fr: "W" }, description: { en: "", fr: "" }, blocks: [] } as never);
    const before = (await getPages()).length;
    const { keys } = await captureSnapshot();
    expect(keys).toBeGreaterThan(0);
    expect(await hasSnapshot()).toBe(true);

    // A visitor adds a page…
    await savePage({ id: "visitor-1", slug: "visitor-page", status: "published", title: { en: "Oops", fr: "Oops" }, description: { en: "", fr: "" }, blocks: [] } as never);
    expect((await getPages()).length).toBe(before + 1);

    // …and the reset takes it away again.
    const result = await resetSandbox();
    expect(result?.restored).toBeGreaterThan(0);
    expect((await getPages()).some((p) => p.slug === "visitor-page")).toBe(false);
    expect((await getSandboxState()).resets).toBe(1);
  });
});
