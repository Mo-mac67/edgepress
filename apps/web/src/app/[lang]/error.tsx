"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook your monitoring here (e.g. Sentry.captureException(error)).
    console.error(error);
  }, [error]);

  return (
    <section className="container-page py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong / Une erreur s’est produite</h1>
      <p className="mt-3 text-ink-soft">Please try again. / Veuillez réessayer.</p>
      <button onClick={reset} className="btn-primary mt-6">
        Try again / Réessayer
      </button>
    </section>
  );
}
