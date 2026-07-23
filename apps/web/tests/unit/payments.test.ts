import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-pay-"));
});

import { recordOrder, getOrders, verifyStripeSignature } from "@/lib/payments";

const SECRET = "whsec_test_123";
const sign = (payload: string, t: number) => `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex")}`;

describe("verifyStripeSignature", () => {
  const now = 1_800_000_000;
  const payload = JSON.stringify({ type: "checkout.session.completed" });

  it("accepts a valid signature within tolerance", () => {
    expect(verifyStripeSignature(payload, sign(payload, now - 60), SECRET, now)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    expect(verifyStripeSignature(payload + "x", sign(payload, now), SECRET, now)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyStripeSignature(payload, sign(payload, now), "whsec_other", now)).toBe(false);
  });

  it("rejects stale timestamps (replay protection)", () => {
    expect(verifyStripeSignature(payload, sign(payload, now - 3600), SECRET, now)).toBe(false);
  });

  it("rejects malformed headers", () => {
    expect(verifyStripeSignature(payload, "", SECRET, now)).toBe(false);
    expect(verifyStripeSignature(payload, "t=abc,v1=", SECRET, now)).toBe(false);
  });
});

describe("orders (fs adapter)", () => {
  it("records a paid order and is idempotent per session (webhook retries)", async () => {
    const first = await recordOrder({ sessionId: "cs_1", product: "Course", amount: 4900, currency: "usd", email: "b@x.co" });
    expect(first?.status).toBe("paid");
    const retry = await recordOrder({ sessionId: "cs_1", product: "Course", amount: 4900, currency: "usd" });
    expect(retry).toBeNull();
    expect((await getOrders()).filter((o) => o.sessionId === "cs_1").length).toBe(1);
  });
});
