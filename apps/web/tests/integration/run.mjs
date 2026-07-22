/**
 * EdgePress integration API suite.
 *
 * Boots the app in filesystem-storage mode against a throwaway data dir and
 * exercises the real HTTP surface end to end: first-run setup, auth, pages,
 * legal pages, Content API + API keys, forms (including the concurrent-write
 * race regression), leads, backup/restore, i18n + RTL, custom code injection,
 * header override, event sharding and rate limiting.
 *
 * No AI calls — everything here runs anywhere (CI included) with zero keys.
 *
 *   node tests/integration/run.mjs        (exits non-zero on any failure)
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Random-ish port so a zombie server from an aborted run can never interfere.
const PORT = Number(process.env.EP_TEST_PORT || 3400 + (process.pid % 400));
const B = `http://localhost:${PORT}`;
const DATA_DIR = mkdtempSync(join(tmpdir(), "ep-int-"));
const FETCH_TIMEOUT = 45_000; // no request may hang the suite
const fetchT = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT) });

let passed = 0;
let failed = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

let cookie = "";
async function api(method, path, body, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
  if (opts.auth !== false && cookie) headers.Cookie = cookie;
  const res = await fetchT(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && opts.keepCookie !== false) cookie = setCookie.split(";")[0];
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* html */
  }
  return { status: res.status, json, raw };
}

async function waitReady(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetchT(`${B}/api/setup`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("server did not become ready");
}

async function main() {
  console.log(`▸ booting app (fs storage) on :${PORT}…`);
  const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: join(import.meta.dirname, "..", ".."),
    shell: process.platform === "win32",
    env: { ...process.env, EDGEPRESS_STORAGE: "fs", DATA_DIR, ADMIN_SECRET: "integration-secret", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  try {
    await waitReady();

    // ── First-run setup & auth ─────────────────────────────
    console.log("▸ setup & auth");
    check("fresh install reports done:false", (await api("GET", "/api/setup")).json?.done === false);
    check("setup rejects short passwords", (await api("POST", "/api/setup", { siteName: "T", password: "123" })).status === 422);
    check("setup succeeds", (await api("POST", "/api/setup", { siteName: "Integration", password: "integration-pw" })).json?.ok === true);
    check("setup cannot run twice", (await api("POST", "/api/setup", { siteName: "X", password: "hijack-pw" })).status === 409);
    cookie = "";
    check("admin API requires auth", (await api("GET", "/api/admin/pages")).status === 401);
    check("wrong password rejected", (await api("POST", "/api/admin/login", { password: "nope-nope" })).status === 401);
    const login = await api("POST", "/api/admin/login", { password: "integration-pw" });
    check("owner login returns role super", login.json?.role === "super");

    // ── Pages lifecycle ────────────────────────────────────
    console.log("▸ pages");
    const created = await api("POST", "/api/admin/pages", { slug: "int-test", title: "Integration Page" });
    check("page create", created.status === 201);
    const page = created.json.page;
    check("draft page hidden from visitors", (await fetchT(`${B}/en/int-test`)).status === 404);
    const put = await api("PUT", `/api/admin/pages/${page.id}`, { ...page, status: "published", blocks: [{ id: "b1", type: "header", data: { title: { en: "Live Header", fr: "" } } }] });
    check("page publish", put.status === 200);
    const pub = await (await fetchT(`${B}/en/int-test`)).text();
    check("published page renders content", pub.includes("Live Header"));

    // ── Legal pages ────────────────────────────────────────
    console.log("▸ legal pages");
    const pages = (await api("GET", "/api/admin/pages")).json.pages;
    check("privacy/terms seeded as system pages", pages.some((p) => p.slug === "privacy" && p.system) && pages.some((p) => p.slug === "terms"));
    check("/en/privacy renders", (await (await fetchT(`${B}/en/privacy`)).text()).includes("What we collect"));

    // ── Content types + Content API + API keys ────────────
    console.log("▸ content API");
    await api("POST", "/api/admin/content-types", { name: "Books", fields: [{ label: "Title", type: "text", required: true }] });
    await api("POST", "/api/admin/content-types/books/entries", { status: "published", data: { title: "Dune" } });
    await api("POST", "/api/admin/content-types/books/entries", { status: "draft", data: { title: "Secret" } });
    const pubApi = (await api("GET", "/api/content/books", null, { auth: false })).json;
    check("public content API returns published only", pubApi.count === 1 && pubApi.entries[0].title === "Dune");
    check("drafts require an API key", (await api("GET", "/api/content/books?status=all", null, { auth: false })).status === 401);
    const key = (await api("POST", "/api/admin/api-keys", { label: "ci" })).json.token;
    const withKey = await fetchT(`${B}/api/content/books?status=all`, { headers: { Authorization: `Bearer ${key}` } });
    check("API key unlocks drafts", (await withKey.json()).count === 2);

    // ── Forms + the concurrent-write race regression ──────
    console.log("▸ forms & race safety");
    await api("POST", "/api/admin/forms", { name: "Contact", fields: [{ label: "Name", type: "text", required: true }, { label: "Message", type: "textarea" }] });
    check("public submit works", (await api("POST", "/api/forms/contact", { name: "Alice", message: "hi" }, { auth: false })).status === 201);
    check("missing required field rejected", (await api("POST", "/api/forms/contact", { message: "no name" }, { auth: false })).status === 422);
    check("honeypot pretends success", (await api("POST", "/api/forms/contact", { name: "Bot", _hp: "x" }, { auth: false })).json?.ok === true);
    // Distinct client IPs so the per-IP rate limit (correctly) doesn't
    // interfere — this measures store concurrency, like real-world traffic.
    const racerResults = await Promise.all(
      [...Array(10)].map((_, i) => api("POST", "/api/forms/contact", { name: `Racer ${i}` }, { auth: false, headers: { "x-forwarded-for": `10.1.0.${i + 1}` } })),
    );
    check("all concurrent submits accepted", racerResults.every((r) => r.status === 201));
    const subs = (await api("GET", "/api/admin/forms/contact/submissions")).json.submissions;
    check("10 CONCURRENT submissions all stored (lost-update regression)", subs.filter((s) => s.data.name?.startsWith("Racer")).length === 10, `got ${subs.length}`);
    const spamRes = await api("POST", "/api/forms/contact", { name: "Spammy", message: "viagra casino http://a.example http://b.example backlink seo service" }, { auth: false, headers: { "x-forwarded-for": "10.2.0.1" } });
    check("spammy submission accepted but flagged", spamRes.status === 201 && (await api("GET", "/api/admin/forms/contact/submissions")).json.submissions.some((s) => s.data.name === "Spammy" && s.spam));
    check("CSV export includes rows", (await api("GET", "/api/admin/forms/contact/submissions?format=csv")).raw.includes("Alice"));

    // ── Leads race regression ──────────────────────────────
    console.log("▸ leads");
    await Promise.all(
      [...Array(8)].map((_, i) =>
        api(
          "POST",
          "/api/leads",
          { name: `Lead ${i}`, phone: "4165551212", email: `lead${i}@example.com`, city: "Toronto", projectType: "renovation", locale: "en" },
          { auth: false, headers: { "x-forwarded-for": `10.3.0.${i + 1}` } },
        ),
      ),
    );
    const leads = (await api("GET", "/api/leads")).json.leads ?? (await api("GET", "/api/leads")).json;
    const leadCount = Array.isArray(leads) ? leads.length : leads.leads?.length;
    check("8 CONCURRENT leads all stored (lost-update regression)", leadCount === 8, `got ${leadCount}`);

    // ── Backup / restore ───────────────────────────────────
    console.log("▸ backup & restore");
    const backup = (await api("GET", "/api/admin/backup")).json;
    check("backup exports documents", Object.keys(backup.docs ?? {}).length > 3);
    await api("DELETE", "/api/admin/content-types/books");
    check("type deleted", (await api("GET", "/api/content/books", null, { auth: false })).status === 404);
    const restore = await api("POST", "/api/admin/backup", backup);
    check("restore succeeds", restore.json?.ok === true);
    check("restored content serves again", (await api("GET", "/api/content/books", null, { auth: false })).json?.count === 1);

    // ── i18n + RTL ─────────────────────────────────────────
    console.log("▸ i18n & RTL");
    const settings = (await api("GET", "/api/admin/settings")).json.settings;
    await api("POST", "/api/admin/settings", { settings: { ...settings, locales: ["en", "fr", "fa"] } });
    check("new locale routes after adding", (await fetchT(`${B}/fa`)).status === 200);
    check("unconfigured locale 404s", (await fetchT(`${B}/de`)).status === 404);
    check("RTL locale renders dir=rtl", /<html[^>]*dir="rtl"/.test(await (await fetchT(`${B}/fa`)).text()));
    check("LTR locale renders dir=ltr", /<html[^>]*dir="ltr"/.test(await (await fetchT(`${B}/en`)).text()));

    // ── Custom code + header override ──────────────────────
    console.log("▸ custom code & chrome overrides");
    const theme = (await api("GET", "/api/admin/theme")).json.theme;
    await api("POST", "/api/admin/theme", { theme: { ...theme, customCss: ".ci-marker{color:red}", customBodyHtml: '<script id="ci-inject"></script>' } });
    check("custom CSS served via /theme.css", (await (await fetchT(`${B}/theme.css`)).text()).includes(".ci-marker"));
    check("custom body code injected", (await (await fetchT(`${B}/en`)).text()).includes('id="ci-inject"'));
    const s2 = (await api("GET", "/api/admin/settings")).json.settings;
    await api("POST", "/api/admin/settings", { settings: { ...s2, customHeaderHtml: '<div id="ci-header">X</div>' } });
    check("header override replaces built-in", (await (await fetchT(`${B}/en`)).text()).includes('id="ci-header"'));
    await api("POST", "/api/admin/settings", { settings: { ...s2, customHeaderHtml: "" } });
    check("clearing override restores built-in", !(await (await fetchT(`${B}/en`)).text()).includes('id="ci-header"'));

    // ── Event sharding ─────────────────────────────────────
    console.log("▸ analytics events");
    await api("POST", "/api/track", { type: "pageview", path: "/en", locale: "en", sessionId: "ci" }, { auth: false });
    const files = readdirSync(DATA_DIR);
    check("events write to weekly shard, not a global doc", files.some((f) => f.startsWith("events-w-")) && !files.includes("events.json"));

    // ── Rate limiting (in-memory path in fs mode) ──────────
    console.log("▸ rate limiting");
    cookie = "";
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const r = await api("POST", "/api/admin/login", { password: "wrong-wrong" }, { keepCookie: false });
      if (r.status === 429) limited = true;
    }
    check("login attempts are rate limited", limited);

    // ── Sitemap ────────────────────────────────────────────
    const sm = await (await fetchT(`${B}/sitemap.xml`)).text();
    check("sitemap lists published page once", (sm.match(/\/en\/int-test/g) ?? []).length === 1);
    check("sitemap has no duplicate legal entries", (sm.match(/\/en\/privacy/g) ?? []).length === 1);
  } finally {
    server.kill();
    // Windows: make sure the whole tree dies.
    if (process.platform === "win32" && server.pid) {
      try {
        const { execSync } = await import("node:child_process");
        execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
      } catch {
        /* already dead */
      }
    }
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failed:", fails.join(" | "));
    if (process.env.CI) console.log("\n--- server log tail ---\n" + serverLog.slice(-3000));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Integration runner crashed:", e);
  process.exit(1);
});
