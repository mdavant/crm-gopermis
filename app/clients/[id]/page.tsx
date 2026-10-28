"use client";
import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { api, type Detail, type Catalog } from "../../../lib/api-types";
import { useApp } from "../../../components/app-context";
import { ClientDetail } from "../../../components/client-detail";

export default function ClientDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can, catalog } = useApp();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [cat, setCat] = useState<Catalog | null>(catalog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, c] = await Promise.all([
        api<Detail>(`clients/${id}`),
        cat ? Promise.resolve(cat) : api<Catalog>("catalog"),
      ]);
      setDetail(d);
      if (!cat) setCat(c);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, cat]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (loading && !detail) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: "#ea580c", margin: "0 auto 12px" }} />
        <p style={{ color: "#64748b", fontWeight: 600 }}>Chargement du dossier élève…</p>
      </div>
    );
  }

  if (!detail || !cat) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px" }}>
          <AlertCircle size={40} style={{ color: "#dc2626", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
            Dossier introuvable ou erreur de chargement
          </h2>
          <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px" }}>
            {error || "Ce dossier élève n'existe pas ou vous n'avez pas l'autorisation d'y accéder."}
          </p>
          <button
            type="button"
            className="btnPrimaryOrange"
            onClick={() => router.push("/clients")}
          >
            <ArrowLeft size={16} />
            Retourner à la liste des élèves
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && <p className="error" role="alert">{error}</p>}
      <ClientDetail
        detail={detail}
        cat={cat}
        can={can}
        back={() => router.push("/clients")}
        reload={loadClient}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
