import { isValidUnsubscribe, unsubscribe } from "@/lib/newsletter-store";

export const dynamic = "force-dynamic";

/** Signed one-click unsubscribe (linked from every campaign email). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const ok = isValidUnsubscribe(email, token) && (await unsubscribe(email));
  const message = ok ? "You're unsubscribed. Sorry to see you go!" : "This unsubscribe link is invalid or already used.";
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Newsletter</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh"><p>${message}</p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" }, status: ok ? 200 : 400 },
  );
}
