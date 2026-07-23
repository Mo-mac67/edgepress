import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ADMIN_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "csec";
  process.env.OAUTH_ALLOWED_EMAILS = "Owner@Example.com, second@example.com";
});

import { allowedEmails, isValidState, makeState, oauthGoogleEnabled } from "@/lib/oauth";

describe("OAuth CSRF state", () => {
  it("round-trips a fresh state", () => {
    const now = 1_800_000_000_000;
    expect(isValidState(makeState(now), now + 1000)).toBe(true);
  });

  it("rejects forged, malformed and missing states", () => {
    expect(isValidState("123.deadbeef")).toBe(false);
    expect(isValidState("garbage")).toBe(false);
    expect(isValidState(null)).toBe(false);
  });

  it("rejects expired and future states", () => {
    const now = 1_800_000_000_000;
    expect(isValidState(makeState(now), now + 11 * 60_000)).toBe(false); // too old
    expect(isValidState(makeState(now + 60_000), now)).toBe(false); // from the future
  });
});

describe("OAuth config", () => {
  it("enabled only when all three env vars exist", () => {
    expect(oauthGoogleEnabled()).toBe(true);
  });

  it("allowlist is normalized to lowercase", () => {
    expect(allowedEmails()).toEqual(["owner@example.com", "second@example.com"]);
  });
});
