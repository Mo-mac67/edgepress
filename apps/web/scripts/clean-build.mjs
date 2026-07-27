// Remove stale build output before an OpenNext build/deploy.
//
// OpenNext + Next reuse `.next` / `.open-next` incrementally. If a previous
// build cached an older source, `cf:deploy` can silently repackage that stale
// output and ship code you already changed. Wiping both dirs first makes every
// deploy build from the current source. Cross-platform (no `rm -rf`), so it
// works the same on Windows, macOS and Linux.
import { rmSync } from "node:fs";

for (const dir of [".next", ".open-next"]) {
  rmSync(dir, { recursive: true, force: true });
}
console.log("✓ cleaned .next and .open-next");
