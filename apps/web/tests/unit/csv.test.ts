import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    const rows = parseCsv('name,note\n"Doe, Jane","She said ""hi""\nsecond line"');
    expect(rows[1][0]).toBe("Doe, Jane");
    expect(rows[1][1]).toBe('She said "hi"\nsecond line');
  });

  it("handles CRLF and skips trailing blank lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvObjects", () => {
  it("maps rows to header-keyed objects", () => {
    expect(parseCsvObjects("Title,Price\nMug,12")).toEqual([{ Title: "Mug", Price: "12" }]);
  });

  it("returns [] without a data row", () => {
    expect(parseCsvObjects("only,header")).toEqual([]);
  });

  it("fills missing trailing cells with empty strings", () => {
    expect(parseCsvObjects("a,b\n1")).toEqual([{ a: "1", b: "" }]);
  });
});

describe("toCsv", () => {
  it("escapes quotes and round-trips", () => {
    const csv = toCsv(["k"], [{ k: 'say "hi"' }]);
    expect(parseCsvObjects(csv)).toEqual([{ k: 'say "hi"' }]);
  });
});
