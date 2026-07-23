import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { findRedirect } from "./redirects-store";

/**
 * 404 interceptor: consult the redirect rules and either redirect or 404.
 * Called only when a route has already failed to resolve, so the happy path
 * never pays for the lookup. (Next serves 308/307 for permanent/temporary —
 * search engines treat 308 exactly like 301.)
 */
export async function redirectOrNotFound(fullPath: string): Promise<never> {
  const hit = await findRedirect(fullPath).catch(() => null);
  if (hit) {
    if (hit.code === 302) redirect(hit.to);
    permanentRedirect(hit.to);
  }
  notFound();
}
