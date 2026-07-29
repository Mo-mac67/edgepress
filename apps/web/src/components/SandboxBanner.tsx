import Link from "next/link";

/**
 * Sandbox notice. Rendered site-wide only when EDGEPRESS_SANDBOX=1, so a real
 * install never shows it. Deliberately plain and non-dismissible: a visitor
 * should never wonder whether their edits are permanent.
 */
export function SandboxBanner({ minutes, login }: { minutes: number; login?: string }) {
  const every = minutes === 60 ? "every hour" : `every ${minutes} minutes`;
  return (
    <div
      role="status"
      className="no-print sticky top-0 z-50 bg-brand-dark px-4 py-2 text-center text-xs text-white"
    >
      <strong className="font-semibold">Sandbox.</strong>{" "}
      Change anything you like — everything here resets {every}.{" "}
      {/* A sandbox nobody can sign into isn't a sandbox; the credentials are
          meant to be public, so they belong on the page. */}
      {login && (
        <>
          Sign in at <Link href="/en/admin" className="underline underline-offset-2">/admin</Link>{" "}
          with <code className="rounded bg-white/15 px-1 py-0.5 font-mono">{login}</code>.{" "}
        </>
      )}
      <a href="https://github.com/Mo-mac67/edgepress" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
        Get your own
      </a>
    </div>
  );
}
