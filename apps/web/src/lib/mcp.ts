import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { getPages, getPage, savePage, blankPage } from "./cms-store";
import { getLeads } from "./leads-store";
import { generatePageBlocks, translatePage } from "./ai/features";
import type { Page } from "./cms-types";

const MCP_KEY = "cms-mcp.json";

export interface McpConfig {
  enabled: boolean;
  token: string;
}
export async function getMcpConfig(): Promise<McpConfig> {
  const c = await readJsonDoc<McpConfig | null>(MCP_KEY, null);
  if (!c) {
    const seeded = { enabled: false, token: `ep_${randomUUID().replace(/-/g, "")}` };
    try {
      await writeJsonDoc(MCP_KEY, seeded);
    } catch {
      /* best effort */
    }
    return seeded;
  }
  if (!c.token) c.token = `ep_${randomUUID().replace(/-/g, "")}`;
  return c;
}
export async function saveMcpConfig(c: McpConfig): Promise<void> {
  await writeJsonDoc(MCP_KEY, c);
}

// ─── Tool definitions (advertised to MCP clients) ───────
export const MCP_TOOLS = [
  { name: "list_pages", description: "List all pages on the site with slug, title and status.", inputSchema: { type: "object", properties: {} } },
  { name: "get_page", description: "Get one page's full content by slug (use '' for the home page).", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "generate_page", description: "Create a new draft page from a natural-language description. Returns the new slug.", inputSchema: { type: "object", properties: { title: { type: "string" }, prompt: { type: "string" }, locale: { type: "string", enum: ["en", "fr"] } }, required: ["prompt"] } },
  { name: "set_page_status", description: "Publish or unpublish a page.", inputSchema: { type: "object", properties: { slug: { type: "string" }, status: { type: "string", enum: ["published", "draft"] } }, required: ["slug", "status"] } },
  { name: "translate_page", description: "Translate a page's content into another locale (additive).", inputSchema: { type: "object", properties: { slug: { type: "string" }, to: { type: "string", enum: ["en", "fr"] } }, required: ["slug", "to"] } },
  { name: "list_leads", description: "List recent CRM leads (name, email, status).", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
] as const;

const ok = (text: string) => ({ content: [{ type: "text", text }] });

/** Execute one MCP tool call. Throws on unknown tool / bad args. */
export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case "list_pages": {
      const pages = await getPages();
      return ok(JSON.stringify(pages.map((p) => ({ slug: p.slug, title: p.title.en || p.slug || "home", status: p.status, blocks: p.blocks.length })), null, 2));
    }
    case "get_page": {
      const page = await getPage(String(args.slug ?? ""));
      if (!page) return ok("Page not found.");
      return ok(JSON.stringify({ slug: page.slug, title: page.title, status: page.status, blocks: page.blocks }, null, 2));
    }
    case "generate_page": {
      const locale = args.locale === "fr" ? "fr" : "en";
      const prompt = String(args.prompt ?? "");
      const title = String(args.title ?? prompt.slice(0, 60));
      const blocks = await generatePageBlocks(prompt, locale);
      const pages = await getPages();
      let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ai-page";
      while (pages.some((p) => p.slug === slug)) slug = `${slug}-2`;
      const page: Page = { ...blankPage(slug, title), status: "draft", blocks, title: { en: "", fr: "", [locale]: title } as Page["title"] };
      await savePage(page);
      return ok(`Created draft page "${title}" at slug "${slug}" with ${blocks.length} blocks.`);
    }
    case "set_page_status": {
      const page = await getPage(String(args.slug ?? ""));
      if (!page) return ok("Page not found.");
      page.status = args.status === "published" ? "published" : "draft";
      await savePage(page);
      return ok(`Page "${page.slug || "home"}" is now ${page.status}.`);
    }
    case "translate_page": {
      const page = await getPage(String(args.slug ?? ""));
      if (!page) return ok("Page not found.");
      const to = args.to === "fr" ? "fr" : "en";
      const from = to === "fr" ? "en" : "fr";
      const translated = await translatePage(page, from, to);
      await savePage(translated);
      return ok(`Translated "${page.slug || "home"}" to ${to.toUpperCase()}.`);
    }
    case "list_leads": {
      const leads = await getLeads();
      const limit = typeof args.limit === "number" ? args.limit : 20;
      return ok(JSON.stringify(leads.slice(0, limit).map((l) => ({ name: l.name, email: l.email, status: l.status, city: l.city })), null, 2));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
