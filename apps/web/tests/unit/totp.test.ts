import { describe, expect, it } from "vitest";
import { generateSecret, totpUri, verifyTotp } from "@edgepress/core/totp";
import { createHmac } from "node:crypto";

// Reference HOTP (RFC 4226) to cross-check our implementation.
function refCode(secretB32: string, step: number): string {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretB32) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const c = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return (c % 1_000_000).toString().padStart(6, "0");
}

describe("totp", () => {
  it("generates a 32-char base32 secret", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current code and rejects a wrong one", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(secret, refCode(secret, step))).toBe(true);
    const wrong = refCode(secret, step + 5);
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it("tolerates ±1 step of clock drift", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(secret, refCode(secret, step - 1))).toBe(true);
    expect(verifyTotp(secret, refCode(secret, step + 1))).toBe(true);
  });

  it("rejects malformed codes", () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("builds a scannable otpauth URI", () => {
    expect(totpUri("SECRETSECRETSECRETSECRETSECRETAA", "owner")).toContain("otpauth://totp/EdgePress:owner?secret=");
  });
});
