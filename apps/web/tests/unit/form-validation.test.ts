import { describe, expect, it } from "vitest";
import { validateSubmission, type FormDef } from "@/lib/forms-store";

const form = (fields: FormDef["fields"]): FormDef => ({
  id: "t1",
  slug: "test",
  name: "Test",
  fields,
  submitLabel: "Send",
  successMessage: "ok",
  createdAt: new Date().toISOString(),
});

describe("validateSubmission rules", () => {
  it("enforces required", () => {
    const f = form([{ key: "name", label: "Name", type: "text", required: true }]);
    expect(validateSubmission(f, {}).ok).toBe(false);
    expect(validateSubmission(f, { name: "  " }).ok).toBe(false);
    expect(validateSubmission(f, { name: "Mo" }).ok).toBe(true);
  });

  it("rejects malformed emails, accepts valid ones", () => {
    const f = form([{ key: "email", label: "Email", type: "email" }]);
    expect(validateSubmission(f, { email: "not-an-email" }).ok).toBe(false);
    expect(validateSubmission(f, { email: "a@b" }).ok).toBe(false);
    expect(validateSubmission(f, { email: "a@b.co" }).ok).toBe(true);
  });

  it("applies regex pattern to text fields", () => {
    const f = form([{ key: "code", label: "Code", type: "text", pattern: "^[A-Z]{2}\\d{4}$" }]);
    expect(validateSubmission(f, { code: "AB1234" }).ok).toBe(true);
    expect(validateSubmission(f, { code: "nope" }).ok).toBe(false);
  });

  it("bounds number values with min/max", () => {
    const f = form([{ key: "qty", label: "Qty", type: "number", min: 1, max: 10 }]);
    expect(validateSubmission(f, { qty: 5 }).ok).toBe(true);
    expect(validateSubmission(f, { qty: 0 }).ok).toBe(false);
    expect(validateSubmission(f, { qty: 11 }).ok).toBe(false);
    expect(validateSubmission(f, { qty: "abc" }).ok).toBe(false);
  });

  it("bounds string length with min/max", () => {
    const f = form([{ key: "msg", label: "Message", type: "textarea", min: 5, max: 10 }]);
    expect(validateSubmission(f, { msg: "hi" }).ok).toBe(false);
    expect(validateSubmission(f, { msg: "just right" }).ok).toBe(true);
    expect(validateSubmission(f, { msg: "way too long here" }).ok).toBe(false);
  });

  it("skips rules for empty optional values", () => {
    const f = form([{ key: "code", label: "Code", type: "text", pattern: "^\\d+$", min: 3 }]);
    expect(validateSubmission(f, { code: "" }).ok).toBe(true);
    expect(validateSubmission(f, {}).ok).toBe(true);
  });
});
