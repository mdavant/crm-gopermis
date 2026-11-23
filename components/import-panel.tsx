"use client";
import React, { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, Loader2, FileUp, CalendarDays, Users, Paperclip } from "lucide-react";
import { api } from "../lib/api-types";

type Plan = {
  version: 1;
  clients: { key: string; firstName: string; lastName: string; category?: string; documents: { driveId: string; name: string; folder?: string }[] }[];
  bookings: { ref: string; clientKey: string; start: string; end: string }[];
};
type PendingDoc = { clientId: string; clientName: string; driveId: string; name: string; folder?: string };
type PlanResult = {
  report: { clientsCreated: number; clientsExisting: number; bookingsCreated: number; bookingsSkipped: number; warnings: string[] };
  documents: PendingDoc[];
};

/**
 * Import initial depuis le fichier préparé à partir du Drive :
 * élèves et séances d'abord, puis chaque pièce récupérée par le serveur.
 */
export function ImportPanel() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "plan" | "docs" | "done">("idle");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, imported: 0, skipped: [] as string[], failed: [] as string[] });
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setError("");
    setResult(null);
    setPhase("idle");
    try {
      const data = JSON.parse(await f.text()) as Plan;
      if (data.version !== 1 || !Array.isArray(data.clients)) throw new Error("Fichier d'import non reconnu.");
      setPlan(data);
      setFileName(f.name);
    } catch (e) {
      setPlan(null);
      setError((e as Error).message || "Fichier illisible.");
    }
  };

  const run = async () => {
    if (!plan) return;
    setError("");
    setPhase("plan");
    try {
      const res = await api<PlanResult>("admin/import/plan", plan);
      setResult(res);
      setPhase("docs");
      const p = { done: 0, total: res.documents.length, imported: 0, skipped: [] as string[], failed: [] as string[] };
      setProgress({ ...p });
      for (const d of res.documents) {
        try {
          const r = await api<{ status: string }>("admin/import/document", {
            clientId: d.clientId,
            driveId: d.driveId,
            name: d.name,
            folder: d.folder,
          });
          if (r.status === "importe" || r.status === "deja-importe") p.imported++;
          else p.skipped.push(`${d.clientName} — ${d.name}`);
        } catch (e) {
          p.failed.push(`${d.clientName} — ${d.name} : ${(e as Error).message}`);
        }
        p.done++;
        setProgress({ ...p, skipped: [...p.skipped], failed: [...p.failed] });
      }
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const docCount = plan?.clients.reduce((a, c) => a + c.documents.length, 0) ?? 0;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="card importCard">
      <div className="sectionCardHeader">
        <div className="sectionTitleWithBadge">
          <FileUp size={18} />
          <h3 className="sectionCardTitle">Import des dossiers élèves</h3>
        </div>
      </div>
      <p className="helperText">
        Chargez le fichier d&apos;import préparé à partir du Google Drive. Les élèves et les séances sont créés, puis chaque pièce
        (identité, permis, fiches…) est récupérée depuis le Drive et rangée dans le dossier de l&apos;élève. L&apos;import peut être
        relancé sans créer de doublon.
      </p>

      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
      <div className="importRow">
        <button type="button" className="btnSecondary" onClick={() => input.current?.click()} disabled={phase === "plan" || phase === "docs"}>
          <Upload size={15} /> Choisir le fichier d&apos;import
        </button>
        {fileName && <span className="importFile">{fileName}</span>}
      </div>

      {plan && (
        <div className="importSummary">
          <div>
            <Users size={16} /> <strong>{plan.clients.length}</strong> élèves
          </div>
          <div>
            <CalendarDays size={16} /> <strong>{plan.bookings.length}</strong> séances
          </div>
          <div>
            <Paperclip size={16} /> <strong>{docCount}</strong> pièces
          </div>
          {phase === "idle" && (
            <button type="button" className="btnPrimary" onClick={() => void run()}>
              Lancer l&apos;import
            </button>
          )}
        </div>
      )}

      {phase === "plan" && (
        <p className="importStatus">
          <Loader2 size={15} className="spin" /> Création des élèves et des séances…
        </p>
      )}

      {result && (
        <div className="importReport">
          <p>
            <CheckCircle2 size={15} /> {result.report.clientsCreated} élève(s) créé(s), {result.report.clientsExisting} déjà présent(s) ·{" "}
            {result.report.bookingsCreated} séance(s) ajoutée(s){result.report.bookingsSkipped ? `, ${result.report.bookingsSkipped} déjà importée(s)` : ""}
          </p>
          {(phase === "docs" || phase === "done") && progress.total > 0 && (
            <>
              <div className="dBar importBar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="importStatus">
                {phase === "docs" ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} Pièces : {progress.done} / {progress.total}{" "}
                · {progress.imported} importée(s)
                {phase === "docs" && " — laissez cette page ouverte"}
              </p>
            </>
          )}
          {phase === "done" && progress.total === 0 && <p>Aucune nouvelle pièce à récupérer.</p>}
          {[...result.report.warnings, ...progress.failed].length > 0 && (
            <details open>
              <summary>
                <AlertTriangle size={14} /> {result.report.warnings.length + progress.failed.length} point(s) à vérifier
              </summary>
              <ul>
                {[...result.report.warnings, ...progress.failed].map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          {progress.skipped.length > 0 && (
            <details>
              <summary>{progress.skipped.length} document(s) Google Docs non transférables (à régénérer depuis le CRM)</summary>
              <ul>
                {progress.skipped.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {error && <p className="genWarn error">{error}</p>}
    </section>
  );
}
