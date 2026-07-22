import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dataDir = "";
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  dataDir = mkdtempSync(join(tmpdir(), "ep-log-"));
  process.env.DATA_DIR = dataDir;
});

import { createLead, getLeads } from "@/lib/leads-store";
import { addSubmission, createForm, deleteSubmission, getSubmissions } from "@/lib/forms-store";

const leadInput = (n: number) => ({
  locale: "en",
  name: `Lead ${n}`,
  email: `l${n}@example.com`,
  phone: "4165551212",
  city: "Toronto",
  projectType: "renovation" as const,
  read: false,
});

describe("race-safe lead writes (the lost-update fix)", () => {
  it("20 CONCURRENT submissions all survive", async () => {
    await Promise.all([...Array(20)].map((_, n) => createLead(leadInput(n))));
    const leads = await getLeads();
    expect(leads).toHaveLength(20); // old read-modify-write lost most of these
    expect(new Set(leads.map((l) => l.name)).size).toBe(20);
  });

  it("reads compact items into the aggregate and clean them up", async () => {
    const files = readdirSync(dataDir);
    expect(files.filter((f) => f.startsWith("lead-item-"))).toHaveLength(0); // compacted by getLeads
    expect(files).toContain("leads.json");
  });

  it("new leads after compaction keep appearing", async () => {
    await createLead(leadInput(100));
    const leads = await getLeads();
    expect(leads.some((l) => l.name === "Lead 100")).toBe(true);
    expect(leads).toHaveLength(21);
  });
});

describe("race-safe form submissions", () => {
  it("concurrent submissions all survive + delete works on merged view", async () => {
    await createForm({ name: "Contact", fields: [{ key: "name", label: "Name", type: "text" }] });
    await Promise.all([...Array(10)].map((_, n) => addSubmission("contact", { name: `S${n}` })));
    let subs = await getSubmissions("contact");
    expect(subs).toHaveLength(10);

    const victim = subs[0];
    expect(await deleteSubmission("contact", victim.id)).toBe(true);
    subs = await getSubmissions("contact");
    expect(subs).toHaveLength(9);
    expect(subs.some((s) => s.id === victim.id)).toBe(false);
  });
});
