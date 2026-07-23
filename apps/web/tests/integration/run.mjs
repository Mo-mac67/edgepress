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
  const appDir = join(import.meta.dirname, "..", "..");
  const env = { ...process.env, EDGEPRESS_STORAGE: "fs", DATA_DIR, ADMIN_SECRET: "integration-secret", NEXT_TELEMETRY_DISABLED: "1" };

  // CI runners are slow at dev-mode per-route compilation (each API route
  // compiles on first hit — 40+ routes made the suite crawl). There we build
  // once and run the production server; locally dev mode keeps iteration fast.
  const prod = !!process.env.CI || process.argv.includes("--prod");
  if (prod) {
    console.log("▸ production build for the test server…");
    const { execSync } = await import("node:child_process");
    execSync("npm run build", { cwd: appDir, env, stdio: "inherit" });
  }

  console.log(`▸ booting app (fs storage, ${prod ? "next start" : "next dev"}) on :${PORT}…`);
  const server = spawn("npx", ["next", prod ? "start" : "dev", "-p", String(PORT)], {
    cwd: appDir,
    shell: process.platform === "win32",
    env,
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

    // ── Publishing workflow: schedule / trash / duplicate / preview ──
    console.log("▸ publishing workflow");
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const schedPage = (await api("POST", "/api/admin/pages", { slug: "sched-test", title: "Scheduled" })).json.page;
    await api("PUT", `/api/admin/pages/${schedPage.id}`, { ...schedPage, status: "draft", publishAt: future, blocks: [{ id: "s1", type: "header", data: { title: { en: "Sched Header", fr: "" } } }] });
    check("future-scheduled draft stays hidden", (await fetchT(`${B}/en/sched-test`)).status === 404);
    await api("PUT", `/api/admin/pages/${schedPage.id}`, { publishAt: past });
    check("past-scheduled draft is live (no cron)", (await (await fetchT(`${B}/en/sched-test`)).text()).includes("Sched Header"));

    const dup = await api("POST", `/api/admin/pages/${schedPage.id}/duplicate`);
    check("duplicate creates a -copy draft", dup.status === 201 && dup.json.page.slug.includes("copy") && dup.json.page.status === "draft");

    const draftPage = (await api("POST", "/api/admin/pages", { slug: "preview-test", title: "Preview" })).json.page;
    await api("PUT", `/api/admin/pages/${draftPage.id}`, { ...draftPage, blocks: [{ id: "p1", type: "header", data: { title: { en: "Preview Header", fr: "" } } }] });
    const pl = (await api("GET", `/api/admin/pages/${draftPage.id}/preview-link`)).json;
    check("preview link issued for draft", typeof pl?.token === "string" && pl.token.length >= 10);
    const previewHtml = await (await fetchT(`${B}/en/${pl.path.replace(/^\//, "")}`)).text();
    check("preview token shows draft to logged-out visitor", previewHtml.includes("Preview Header") && previewHtml.includes("Draft preview"));
    check("wrong preview token stays hidden", (await fetchT(`${B}/en/preview-test?preview=not-the-token`)).status === 404);

    await api("DELETE", `/api/admin/pages/${draftPage.id}`);
    const afterTrash = (await api("GET", "/api/admin/pages")).json.pages.find((p) => p.id === draftPage.id);
    check("delete soft-trashes (restorable)", afterTrash?.trashed === true);
    await api("PUT", `/api/admin/pages/${draftPage.id}`, { trashed: false });
    check("restore clears the trashed flag", !(await api("GET", "/api/admin/pages")).json.pages.find((p) => p.id === draftPage.id)?.trashed);
    await api("DELETE", `/api/admin/pages/${draftPage.id}?force=1`);
    check("force delete removes for good", !(await api("GET", "/api/admin/pages")).json.pages.some((p) => p.id === draftPage.id));

    const post = (await api("POST", "/api/admin/posts", { slug: "wf-post", title: "WF Post" })).json.post;
    await api("DELETE", `/api/admin/posts/${post.id}`);
    check("post delete soft-trashes too", (await api("GET", "/api/admin/posts")).json.posts.find((p) => p.id === post.id)?.trashed === true);
    await api("PUT", `/api/admin/posts/${post.id}`, { trashed: false });
    check("post restore works", !(await api("GET", "/api/admin/posts")).json.posts.find((p) => p.id === post.id)?.trashed);

    // ── Public site search ─────────────────────────────────
    console.log("▸ site search");
    check("query under 2 chars rejected", (await api("GET", "/api/search?q=x", null, { auth: false })).status === 400);
    const found = (await api("GET", "/api/search?q=Live+Header&lang=en", null, { auth: false })).json;
    check("search finds the published page", found?.results?.some((r) => r.path === "int-test"));
    check("search never returns drafts/trashed", !found?.results?.some((r) => r.path.includes("preview-test") || r.path.includes("copy")));
    check("search page renders results", (await (await fetchT(`${B}/en/search?q=Live+Header`)).text()).includes("int-test"));

    // ── Form validation rules + per-form notification ─────
    console.log("▸ form validation rules");
    await api("POST", "/api/admin/forms", {
      name: "Rules", notifyEmail: "owner@example.com",
      fields: [
        { label: "Code", type: "text", pattern: "^[A-Z]{2}\\d{4}$", required: true },
        { label: "Qty", type: "number", min: 1, max: 10 },
        { label: "Email", type: "email" },
      ],
    });
    const rulesForm = (await api("GET", "/api/admin/forms")).json.forms.find((f) => f.slug === "rules");
    check("rules + notifyEmail persist on the form", rulesForm?.notifyEmail === "owner@example.com" && rulesForm?.fields[0]?.pattern === "^[A-Z]{2}\\d{4}$");
    const okSub = await api("POST", "/api/forms/rules", { code: "AB1234", qty: 5, email: "a@b.co" }, { auth: false, headers: { "x-forwarded-for": "10.4.0.1" } });
    check("valid submission passes all rules", okSub.status === 201);
    check("pattern violation rejected", (await api("POST", "/api/forms/rules", { code: "bad" }, { auth: false, headers: { "x-forwarded-for": "10.4.0.2" } })).status === 422);
    check("number over max rejected", (await api("POST", "/api/forms/rules", { code: "AB1234", qty: 99 }, { auth: false, headers: { "x-forwarded-for": "10.4.0.3" } })).status === 422);
    check("malformed email rejected", (await api("POST", "/api/forms/rules", { code: "AB1234", email: "nope" }, { auth: false, headers: { "x-forwarded-for": "10.4.0.4" } })).status === 422);

    // ── Collection relations + expand ──────────────────────
    console.log("▸ relations");
    const bookSlug = (await api("GET", "/api/content/books", null, { auth: false })).json.entries[0].slug;
    await api("POST", "/api/admin/content-types", {
      name: "Reviews",
      fields: [{ label: "Quote", type: "text", required: true }, { label: "Book", type: "relation", relatesTo: "books" }],
    });
    await api("POST", "/api/admin/content-types/reviews/entries", { status: "published", data: { quote: "A classic.", book: bookSlug } });
    const flatRel = (await api("GET", "/api/content/reviews", null, { auth: false })).json;
    check("relation stays a slug without expand", flatRel.entries[0].book === bookSlug);
    const expanded = (await api("GET", "/api/content/reviews?expand=1", null, { auth: false })).json;
    check("?expand=1 embeds the related entry", expanded.entries[0].book?.title === "Dune" && expanded.entries[0].book?.slug === bookSlug);

    // ── Nested menus ───────────────────────────────────────
    console.log("▸ nested menus");
    await api("POST", "/api/admin/nav", {
      nav: [{
        id: "n1", label: { en: "Work", fr: "Travaux" }, href: "int-test",
        children: [{ id: "n2", label: { en: "Sub Nine", fr: "" }, href: "sched-test", children: [{ id: "n3", label: { en: "TooDeep", fr: "" }, href: "x" }] }],
      }],
    });
    const savedNav = (await api("GET", "/api/admin/nav")).json.nav;
    check("sub-links persist", savedNav[0]?.children?.[0]?.label?.en === "Sub Nine");
    check("depth caps at one sub-level", savedNav[0]?.children?.[0]?.children === undefined);
    check("sub-link renders in the site menu", (await (await fetchT(`${B}/en`)).text()).includes("Sub Nine"));

    // ── Redirect manager ───────────────────────────────────
    console.log("▸ redirects");
    check("redirect rule created", (await api("POST", "/api/admin/redirects", { from: "/old-page.html", to: "/en/int-test" })).status === 201);
    await api("POST", "/api/admin/redirects", { from: "/legacy/*", to: "/en/blog/*", code: 302 });
    check("self-redirect rejected", (await api("POST", "/api/admin/redirects", { from: "/loop", to: "/loop" })).status === 422);
    const r1 = await fetchT(`${B}/old-page.html`, { redirect: "manual" });
    check("old URL 30x-redirects to the new page", [301, 302, 307, 308].includes(r1.status) && (r1.headers.get("location") ?? "").includes("/en/int-test"));
    const r2 = await fetchT(`${B}/legacy/deep/post`, { redirect: "manual" });
    check("wildcard rule carries the tail over", [301, 302, 307, 308].includes(r2.status) && (r2.headers.get("location") ?? "").includes("/en/blog"));
    check("unknown paths still 404", (await fetchT(`${B}/definitely-not-here`)).status === 404);

    // ── Post categories/tags + comments ────────────────────
    console.log("▸ taxonomy & comments");
    const taxPost = (await api("POST", "/api/admin/posts", { slug: "tax-post", title: "Tax Post" })).json.post;
    await api("PUT", `/api/admin/posts/${taxPost.id}`, { status: "published", categories: ["Guides", "News!"], tags: ["Next JS"] });
    const taxSaved = (await api("GET", "/api/admin/posts")).json.posts.find((p) => p.id === taxPost.id);
    check("categories/tags normalized to slugs", taxSaved.categories.join(",") === "guides,news" && taxSaved.tags[0] === "next-js");
    check("blog index filters by category", (await (await fetchT(`${B}/en/blog?cat=guides`)).text()).includes("tax-post") && !(await (await fetchT(`${B}/en/blog?cat=nope`)).text()).includes("tax-post"));

    const cRes = await api("POST", "/api/comments/tax-post", { author: "Visitor", body: "Great write-up!" }, { auth: false });
    check("comment lands in moderation (pending)", cRes.status === 201 && cRes.json.pending === true);
    check("pending comment invisible publicly", ((await api("GET", "/api/comments/tax-post", null, { auth: false })).json.comments ?? []).length === 0);
    const cid = (await api("GET", "/api/admin/comments")).json.comments.find((c) => c.author === "Visitor")?.id;
    await api("PATCH", `/api/admin/comments/${cid}`, { status: "approved" });
    check("approved comment shows on the API", (await api("GET", "/api/comments/tax-post", null, { auth: false })).json.comments.some((c) => c.author === "Visitor"));
    check("approved comment renders on the post", (await (await fetchT(`${B}/en/blog/tax-post`)).text()).includes("Great write-up!"));
    check("comments on unknown posts rejected", (await api("POST", "/api/comments/none", { author: "X", body: "Y" }, { auth: false, headers: { "x-forwarded-for": "10.5.0.9" } })).status === 404);

    // ── Forms v2: conditional + multipart file upload ─────
    console.log("▸ forms v2");
    await api("POST", "/api/admin/forms", {
      name: "Apply",
      fields: [
        { label: "Kind", type: "select", options: ["personal", "business"] },
        { label: "Company", type: "text", required: true, showIf: { field: "kind", equals: "business" }, step: 1 },
        { label: "Resume", type: "file", step: 2 },
      ],
    });
    check("hidden conditional field skips required", (await api("POST", "/api/forms/apply", { kind: "personal" }, { auth: false, headers: { "x-forwarded-for": "10.6.0.1" } })).status === 201);
    check("visible conditional field enforced", (await api("POST", "/api/forms/apply", { kind: "business" }, { auth: false, headers: { "x-forwarded-for": "10.6.0.2" } })).status === 422);
    const fd = new FormData();
    fd.append("kind", "personal");
    fd.append("resume", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cv.pdf", { type: "application/pdf" }));
    const up = await fetchT(`${B}/api/forms/apply`, { method: "POST", body: fd, headers: { "x-forwarded-for": "10.6.0.3" } });
    check("multipart file upload accepted", up.status === 201);
    const applySubs = (await api("GET", "/api/admin/forms/apply/submissions")).json.submissions;
    const fileUrl = applySubs.find((s) => s.data.resume)?.data.resume;
    check("upload stored under /api/media", typeof fileUrl === "string" && fileUrl.startsWith("/api/media/form-uploads/"));
    if (typeof fileUrl === "string") check("uploaded file is served back", (await fetchT(`${B}${fileUrl}`)).status === 200);
    check("media path traversal blocked", (await fetchT(`${B}/api/media/..%2F..%2Fadmin-config.json`)).status === 404 && (await fetchT(`${B}/api/media/form-uploads/../../admin-config.json`)).status === 404);
    const badFd = new FormData();
    badFd.append("kind", "personal");
    badFd.append("resume", new File([new Uint8Array(8)], "evil.exe", { type: "application/x-msdownload" }));
    check("disallowed file type rejected", (await fetchT(`${B}/api/forms/apply`, { method: "POST", body: badFd, headers: { "x-forwarded-for": "10.6.0.4" } })).status === 422);

    // ── Newsletter ─────────────────────────────────────────
    console.log("▸ newsletter");
    check("public signup works", (await api("POST", "/api/newsletter", { email: "reader@example.com" }, { auth: false })).status === 201);
    await api("POST", "/api/newsletter", { email: "READER@example.com" }, { auth: false, headers: { "x-forwarded-for": "10.7.0.1" } });
    const nl = (await api("GET", "/api/admin/newsletter")).json;
    check("signup deduped case-insensitively", nl.subscribers.filter((s) => s.email === "reader@example.com").length === 1);
    check("bad email rejected", (await api("POST", "/api/newsletter", { email: "nope" }, { auth: false, headers: { "x-forwarded-for": "10.7.0.2" } })).status === 422);
    const camp = await api("POST", "/api/admin/newsletter/send", { subject: "Hello", body: "First issue" });
    check("campaign records (logged, key-free)", camp.status === 200 && camp.json.campaign.recipients >= 1 && camp.json.campaign.delivered === false);
    const badUnsub = await fetchT(`${B}/api/newsletter/unsubscribe?email=reader@example.com&token=forged`);
    check("forged unsubscribe link rejected", badUnsub.status === 400);

    // ── Payments (config surface; live Stripe not reachable in CI) ──
    console.log("▸ payments");
    check("checkout cleanly 503s when unconfigured", (await api("POST", "/api/pay/checkout", { pageId: "x", blockId: "y" }, { auth: false })).status === 503);
    await api("POST", "/api/admin/payments", { stripeSecretKey: "sk_test_fake", stripeWebhookSecret: "whsec_fake" });
    const payCfg = (await api("GET", "/api/admin/payments")).json.config;
    check("keys stored but masked on read", payCfg.stripeSecretKey === "set" && payCfg.stripeWebhookSecret === "set");
    check("webhook rejects unsigned calls", (await api("POST", "/api/pay/webhook", { type: "checkout.session.completed" }, { auth: false })).status === 400);
    await api("POST", "/api/admin/payments", { stripeSecretKey: "", stripeWebhookSecret: "" }); // clear again

    // ── Reusable snippets + booking ────────────────────────
    console.log("▸ snippets & booking");
    await api("POST", "/api/admin/snippets", { name: "Promo Banner", html: "<b>SNIPPET-LIVE</b>" });
    const snipPage = (await api("POST", "/api/admin/pages", { slug: "snip-test", title: "Snip" })).json.page;
    await api("PUT", `/api/admin/pages/${snipPage.id}`, { status: "published", blocks: [{ id: "s1", type: "html", data: { code: "<div>[snippet promo-banner] and [snippet missing-one]</div>" } }] });
    const snipHtml = await (await fetchT(`${B}/en/snip-test`)).text();
    check("snippet token expands on the page", snipHtml.includes("SNIPPET-LIVE"));
    check("unknown snippet degrades silently", !snipHtml.includes("[snippet missing-one]"));

    await api("POST", "/api/admin/booking", { enabled: true, slotMinutes: 60 });
    const bookDate = (() => { const d = new Date(Date.now() + 7 * 86_400_000); d.setDate(d.getDate() + ((8 - d.getDay()) % 7)); return d.toISOString().slice(0, 10); })(); // a future Monday
    const slots1 = (await api("GET", `/api/booking?date=${bookDate}`, null, { auth: false })).json.slots;
    check("slots offered from weekly availability", Array.isArray(slots1) && slots1.includes("09:00"));
    check("booking a slot works", (await api("POST", "/api/booking", { date: bookDate, time: "09:00", name: "Visitor", email: "v@x.co" }, { auth: false })).status === 201);
    check("booked slot disappears from availability", !(await api("GET", `/api/booking?date=${bookDate}`, null, { auth: false })).json.slots.includes("09:00"));
    check("double-booking rejected", (await api("POST", "/api/booking", { date: bookDate, time: "09:00", name: "V2", email: "v2@x.co" }, { auth: false, headers: { "x-forwarded-for": "10.8.0.2" } })).status === 422);
    const bookingId = (await api("GET", "/api/admin/booking")).json.bookings.find((b) => b.slot === `${bookDate}T09:00` && b.status === "confirmed")?.id;
    await api("DELETE", `/api/admin/booking?id=${bookingId}`);
    check("admin cancel frees the slot", (await api("GET", `/api/booking?date=${bookDate}`, null, { auth: false })).json.slots.includes("09:00"));

    // ── OAuth flag ─────────────────────────────────────────
    check("SSO reports disabled without env config", (await api("GET", "/api/auth/oauth/google", null, { auth: false })).json.enabled === false);
    check("SSO start 404s when unconfigured", (await fetchT(`${B}/api/auth/oauth/google/start`)).status === 404);

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
  // Windows: the dev server's surviving pipe handles can keep this process
  // alive after a successful run — exit explicitly so pipelines see EOF.
  process.exit(0);
}

main().catch((e) => {
  console.error("Integration runner crashed:", e);
  process.exit(1);
});
