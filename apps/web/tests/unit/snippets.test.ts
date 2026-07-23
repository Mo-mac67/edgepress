import { describe, expect, it } from "vitest";
import { hasSnippetTokens, renderSnippets } from "@/lib/snippets-store";

const snippets = [
  { name: "hours", html: "<b>Open 7 days</b>" },
  { name: "promo-2026", html: '<div class="promo">Summer sale <em>[snippet hours]</em></div>' },
];

describe("renderSnippets", () => {
  it("replaces tokens with snippet HTML", () => {
    expect(renderSnippets("Before [snippet hours] after", snippets)).toBe("Before <b>Open 7 days</b> after");
  });

  it("replaces multiple + repeated tokens in one pass", () => {
    expect(renderSnippets("[snippet hours][snippet hours]", snippets)).toBe("<b>Open 7 days</b><b>Open 7 days</b>");
  });

  it("is non-recursive — nested tokens are NOT re-expanded (no loops)", () => {
    const out = renderSnippets("[snippet promo-2026]", snippets);
    expect(out).toContain("[snippet hours]"); // stays literal
  });

  it("unknown names become an HTML comment, not an error", () => {
    expect(renderSnippets("x [snippet nope] y", snippets)).toBe('x <!-- snippet "nope" not found --> y');
  });

  it("leaves token-free content untouched", () => {
    const html = "<p>plain [not a token] content</p>";
    expect(renderSnippets(html, snippets)).toBe(html);
    expect(hasSnippetTokens(html)).toBe(false);
    expect(hasSnippetTokens("a [snippet hours] b")).toBe(true);
  });
});
