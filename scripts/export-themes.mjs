/**
 * Writes every gallery theme to `themes/<id>.edgepress-theme.json` in exactly
 * the format Appearance → Import theme accepts. Generated, never hand-edited —
 * the gallery in packages/core is the single source of truth, and CI re-runs
 * this to prove the files haven't drifted.
 *
 *   node scripts/export-themes.mjs          # write
 *   node scripts/export-themes.mjs --check  # fail if anything is stale
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "themes");
const check = process.argv.includes("--check");

// packages/core is TypeScript source with extensionless imports, which Node
// can't load directly — bundle it to a temp ESM file with the esbuild the app
// already depends on, then import that.
const { build } = await import(pathToFileURL(join(root, "apps/web/node_modules/esbuild/lib/main.js")).href);
const bundle = join(tmpdir(), `edgepress-themes-${process.pid}.mjs`);
await build({
  entryPoints: [join(root, "packages/core/src/types.ts")],
  outfile: bundle,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { THEME_PRESETS, DEFAULT_THEME, presetToTheme } = await import(pathToFileURL(bundle).href);
rmSync(bundle, { force: true });

mkdirSync(outDir, { recursive: true });

let stale = [];
for (const preset of THEME_PRESETS) {
  const theme = presetToTheme(preset, DEFAULT_THEME);
  const file = join(outDir, `${preset.id}.edgepress-theme.json`);
  const body =
    JSON.stringify(
      {
        edgepressTheme: 1,
        name: preset.label,
        description: preset.description ?? "",
        theme,
      },
      null,
      2,
    ) + "\n";

  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== body) stale.push(preset.id);
  } else {
    writeFileSync(file, body);
  }
}

if (check) {
  if (stale.length) {
    console.error(`Stale theme files: ${stale.join(", ")}\nRun: node scripts/export-themes.mjs`);
    process.exit(1);
  }
  console.log(`All ${THEME_PRESETS.length} theme files are up to date.`);
} else {
  console.log(`Wrote ${THEME_PRESETS.length} themes to themes/`);
}
