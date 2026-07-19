"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#4a5a53", marginTop: "0.5rem" }}>Please try again.</p>
          <button onClick={reset} style={{ marginTop: "1.5rem", background: "#0e7c5a", color: "#fff", border: "none", padding: "0.7rem 1.4rem", borderRadius: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
