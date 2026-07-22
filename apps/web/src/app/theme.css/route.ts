import { getTheme } from "@/lib/cms-store";
import { themeCss } from "@/lib/cms-types";

/**
 * Live theme stylesheet. The public pages are static (free-plan CPU limit), so
 * the theme can't be baked per-request — but this tiny dynamic route can:
 * it just reads the theme from KV and returns the CSS variables (no React
 * render, negligible CPU). The layout links it, so Appearance-panel edits
 * (accent colour, fonts, radius…) apply live without a redeploy.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let css = "";
  try {
    const theme = await getTheme();
    css = themeCss(theme);
    // Site-wide custom CSS from Appearance → Custom CSS, appended last so it can
    // override the theme variables.
    if (theme.customCss?.trim()) css += `\n\n/* --- custom css --- */\n${theme.customCss}`;
  } catch {
    css = "";
  }
  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      // No response cache: the browser/edge must re-fetch every load so an
      // Appearance-panel edit shows on the next refresh (bounded only by KV's
      // own ~60s propagation). It's a tiny KV read, so this stays cheap.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
