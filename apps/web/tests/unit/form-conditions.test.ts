import { describe, expect, it } from "vitest";
import { isFieldVisible, validateSubmission, type FormDef, type FormField } from "@/lib/forms-store";

const form = (fields: FormDef["fields"]): FormDef => ({
  id: "t1",
  slug: "test",
  name: "Test",
  fields,
  submitLabel: "Send",
  successMessage: "ok",
  createdAt: new Date().toISOString(),
});

describe("conditional fields (showIf)", () => {
  const company: FormField = { key: "company", label: "Company", type: "text", required: true, showIf: { field: "kind", equals: "business" } };
  const f = form([{ key: "kind", label: "Kind", type: "select", options: ["personal", "business"] }, company]);

  it("visibility follows the controlling field", () => {
    expect(isFieldVisible(company, { kind: "business" })).toBe(true);
    expect(isFieldVisible(company, { kind: "personal" })).toBe(false);
    expect(isFieldVisible(company, {})).toBe(false);
  });

  it("hidden fields are not required and not stored", () => {
    const r = validateSubmission(f, { kind: "personal", company: "sneaky" });
    expect(r.ok).toBe(true);
    if (r.ok) expect("company" in r.data).toBe(false);
  });

  it("visible conditional fields are enforced", () => {
    expect(validateSubmission(f, { kind: "business" }).ok).toBe(false); // company required
    expect(validateSubmission(f, { kind: "business", company: "Acme" }).ok).toBe(true);
  });

  it("checkbox controllers match on 'true'/'false' strings", () => {
    const extra: FormField = { key: "details", label: "Details", type: "text", showIf: { field: "more", equals: "true" } };
    expect(isFieldVisible(extra, { more: true })).toBe(true);
    expect(isFieldVisible(extra, { more: false })).toBe(false);
  });
});

describe("multi-step + file fields survive schema validation", () => {
  it("file field value (upload URL) passes through", () => {
    const f = form([{ key: "resume", label: "Resume", type: "file", required: true }]);
    expect(validateSubmission(f, {}).ok).toBe(false);
    const r = validateSubmission(f, { resume: "/api/media/form-uploads/test/abc.pdf" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.resume).toContain("/api/media/");
  });
});
