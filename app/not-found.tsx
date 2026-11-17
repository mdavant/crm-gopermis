import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "20px", textAlign: "center" }}>
      <div style={{ maxWidth: "480px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px", color: "#0f172a" }}>404</h2>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px" }}>Page introuvable ou déplacée.</p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 18px",
            background: "#ea580c",
            color: "#ffffff",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            textDecoration: "none",
          }}
        >
          Retourner à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
