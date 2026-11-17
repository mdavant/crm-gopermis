"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "20px", textAlign: "center" }}>
      <div style={{ maxWidth: "480px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 8px", color: "#dc2626" }}>Une erreur est survenue</h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>{error.message || "Une erreur inattendue s'est produite."}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "8px 18px",
            background: "#ea580c",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
