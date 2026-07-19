// Minimal smoke test: checks key pages respond and tracking works.
// Start the app first (npm run dev), then: npm run smoke
const BASE = process.env.BASE_URL ?? "http://localhost:3210";

const paths = ["/en", "/fr", "/en/programs", "/en/learn", "/en/eligibility", "/en/commercial", "/sitemap.xml", "/robots.txt"];

async function main() {
  let pass = 0;
  for (const p of paths) {
    try {
      const res = await fetch(BASE + p);
      const ok = res.status === 200;
      console.log(`${ok ? "PASS" : "FAIL"}  ${res.status}  ${p}`);
      if (ok) pass++;
    } catch (err) {
      console.log(`FAIL  ERR   ${p}  (${err.message})`);
    }
  }
  try {
    const t = await fetch(BASE + "/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "pageview", path: "/en", locale: "en", sessionId: "smoke" }),
    });
    console.log(`${t.ok ? "PASS" : "FAIL"}  ${t.status}  POST /api/track`);
    if (t.ok) pass++;
  } catch (err) {
    console.log(`FAIL  ERR   POST /api/track (${err.message})`);
  }
  console.log(`\n${pass}/${paths.length + 1} checks passed.`);
  if (pass < paths.length + 1) process.exitCode = 1;
}

main();
