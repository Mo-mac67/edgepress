import "server-only";
import { isSandbox } from "./sandbox";

/**
 * One gate for "may this instance reach the outside world?".
 *
 * Every email sender already degrades gracefully when there's no API key — it
 * logs what it would have sent and returns. Withholding the key in sandbox mode
 * reuses that path exactly, so a stranger poking at the demo can't email real
 * people, and no sender needs its own sandbox branch. A sender added later
 * picks the behaviour up for free by asking here for the key.
 */
export function emailApiKey(): string | undefined {
  if (isSandbox()) return undefined;
  return process.env.RESEND_API_KEY || undefined;
}
