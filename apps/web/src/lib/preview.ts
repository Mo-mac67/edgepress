import "server-only";
import { createHash } from "node:crypto";

/**
 * Shareable draft-preview links: /en/<slug>?preview=<token>. The token is an
 * HMAC-style digest of the page id + ADMIN_SECRET, so only someone given the
 * link (by an admin) can view the draft — no login needed, nothing guessable.
 */
export function previewToken(pageId: string): string {
  const secret = process.env.ADMIN_SECRET ?? "dev-secret-change-me";
  return createHash("sha256").update(`preview:${pageId}:${secret}`).digest("hex").slice(0, 20);
}

export function isValidPreview(pageId: string, token: string | undefined | null): boolean {
  return !!token && token === previewToken(pageId);
}
