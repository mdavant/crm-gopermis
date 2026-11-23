/**
 * Génération des documents GoPermis en PDF (fiche de location, attestation
 * d'assurance), à l'identique des modèles Word de l'auto-école.
 * Police : Liberation Serif (métriques identiques à Times New Roman, licence OFL).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const A4: [number, number] = [595.28, 841.89];
const ASSETS = () => join(process.cwd(), "assets", "documents");

type Kit = { regular: PDFFont; bold: PDFFont; logo: PDFImage; stamp: PDFImage };

let assetCache: Promise<Record<string, Uint8Array>> | null = null;
function loadAssets() {
  assetCache ??= (async () => {
    const names = ["LiberationSerif-Regular.ttf", "LiberationSerif-Bold.ttf", "logo-gopermis.png", "cachet-gopermis.jpg"];
    const files = await Promise.all(names.map((n) => readFile(join(ASSETS(), n))));
    return Object.fromEntries(names.map((n, i) => [n, new Uint8Array(files[i])]));
  })().catch((e) => {
    assetCache = null;
    throw e;
  });
  return assetCache;
}

async function newDoc(title: string) {
  const a = await loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setAuthor("GoPermis");
  doc.setCreator("GoPermis CRM");
  doc.setProducer("GoPermis CRM");
  const kit: Kit = {
    regular: await doc.embedFont(a["LiberationSerif-Regular.ttf"], { subset: true }),
    bold: await doc.embedFont(a["LiberationSerif-Bold.ttf"], { subset: true }),
    logo: await doc.embedPng(a["logo-gopermis.png"]),
    stamp: await doc.embedJpg(a["cachet-gopermis.jpg"]),
  };
  return { doc, kit };
}

/* ------------------------------------------------------------ Mise en page */

const BLACK = rgb(0, 0, 0);
const ASCENT = 0.891; // ascendante Liberation Serif

type Run = { text: string; bold?: boolean };

/** Écrit une suite de segments (gras / normal) avec retour à la ligne ; renvoie le haut de la ligne suivante. */
function paragraph(
  page: PDFPage,
  kit: Kit,
  runs: Run[] | string,
  opts: { x: number; top: number; size: number; width: number; lineHeight?: number; align?: "left" | "center"; bold?: boolean },
) {
  const parts: Run[] = typeof runs === "string" ? [{ text: runs, bold: opts.bold }] : runs;
  const lh = opts.lineHeight ?? opts.size * 1.15;
  // Découpe en mots en gardant la police de chaque segment.
  const words: { w: string; bold: boolean; space: boolean }[] = [];
  for (const p of parts) {
    const tokens = p.text.split(/(\s+)/).filter((t) => t.length);
    for (const t of tokens) words.push({ w: t, bold: !!p.bold, space: /^\s+$/.test(t) });
  }
  const font = (b: boolean) => (b ? kit.bold : kit.regular);
  const widthOf = (t: string, b: boolean) => font(b).widthOfTextAtSize(t, opts.size);
  const lines: { w: string; bold: boolean }[][] = [[]];
  let lineWidth = 0;
  for (const wd of words) {
    const cur = lines[lines.length - 1];
    const ww = widthOf(wd.space ? " " : wd.w, wd.bold);
    if (!wd.space && lineWidth + ww > opts.width && cur.some((x) => x.w.trim())) {
      while (cur.length && !cur[cur.length - 1].w.trim()) cur.pop();
      lines.push([]);
      lineWidth = 0;
    }
    if (wd.space && lineWidth === 0) continue;
    lines[lines.length - 1].push({ w: wd.space ? " " : wd.w, bold: wd.bold });
    lineWidth += ww;
  }
  let top = opts.top;
  for (const line of lines) {
    const total = line.reduce((s, x) => s + widthOf(x.w, x.bold), 0);
    let x = opts.align === "center" ? opts.x + (opts.width - total) / 2 : opts.x;
    const y = A4[1] - top - opts.size * ASCENT;
    for (const seg of line) {
      page.drawText(seg.w, { x, y, size: opts.size, font: font(seg.bold), color: BLACK });
      x += widthOf(seg.w, seg.bold);
    }
    top += lh;
  }
  return top;
}

const rule = (page: PDFPage, top: number) =>
  page.drawRectangle({ x: 56.63, y: A4[1] - top - 2.3, width: 451.58, height: 2.3, color: rgb(0.627, 0.627, 0.627) });

const placeImage = (page: PDFPage, img: PDFImage, x: number, top: number, w: number, h: number) =>
  page.drawImage(img, { x, y: A4[1] - top - h, width: w, height: h });

/* ------------------------------------------------------------- Formatage */

export function frDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
const frTime = (hhmm: string) => hhmm.replace(":", "h");
const euros = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).replace(/ | /g, " ")}€`;
function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}H${String(m).padStart(2, "0")}` : `${h}H`;
}

/* ----------------------------------------------------- Fiche de location */

export type RentalData = {
  client: { lastName: string; firstName: string; birthDate?: string | null; address?: string | null; phone?: string | null; email?: string | null; neph?: string | null };
  vehicle: { brand?: string | null; model?: string | null; registration?: string | null; color?: string | null };
  start: { date: string; time: string };
  end: { date: string; time: string };
  hourlyCents?: number | null;
  totalCents: number;
  signatureDate: string;
};

export function rentalDurationMinutes(d: Pick<RentalData, "start" | "end">) {
  const a = new Date(`${d.start.date}T${d.start.time}:00`).getTime();
  const b = new Date(`${d.end.date}T${d.end.time}:00`).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

export async function buildRentalPdf(d: RentalData) {
  const { doc, kit } = await newDoc(`Fiche de location - ${d.client.lastName} ${d.client.firstName}`);
  const p1 = doc.addPage(A4);
  placeImage(p1, kit.logo, 16.18, 66.01, 91.74, 91.74);
  paragraph(p1, kit, "GO PERMIS", { x: 108, top: 95, size: 12, width: 437, align: "center", bold: true });
  paragraph(p1, kit, "FICHE DE LOCATION DE VÉHICULE À DOUBLE COMMANDE", { x: 108, top: 120.8, size: 12, width: 437, align: "center", bold: true });

  const L = { x: 56.8, size: 12, width: 451, lineHeight: 13.8 };
  const line = (top: number, label: string, value?: string | null) => paragraph(p1, kit, `${label}${value ?? ""}`, { ...L, top });
  let t = paragraph(p1, kit, "INFORMATIONS SUR LE LOCATAIRE :", { ...L, top: 172.4, bold: true });
  t = line(t, "Nom : ", d.client.lastName.toUpperCase());
  t = line(t, "Prénom : ", d.client.firstName);
  t = line(t, "Date de naissance : ", d.client.birthDate ? frDate(d.client.birthDate) : "");
  t = line(t, "Adresse : ", d.client.address);
  t = line(t, "Téléphone : ", d.client.phone);
  t = line(t, "Email : ", d.client.email);
  t = line(t, "NEPH : ", d.client.neph);
  t = paragraph(p1, kit, "Photocopie de la pièce d’identité du locataire / conducteur apprentis", { ...L, top: t + 13.8 });

  let top = Math.max(335.75, t + 25);
  rule(p1, top);
  t = paragraph(p1, kit, "INFORMATIONS SUR LE VÉHICULE :", { ...L, top: top + 26.3, bold: true });
  t = line(t, "Marque : ", d.vehicle.brand);
  t = line(t, "Modèle : ", d.vehicle.model);
  t = line(t, "Numéro d’immatriculation : ", d.vehicle.registration);
  t = line(t, "Couleur : ", d.vehicle.color);
  t = line(t, "Type de véhicule : ", "Véhicule à double commande");

  top = Math.max(469.99, t + 25);
  rule(p1, top);
  t = paragraph(p1, kit, "PÉRIODE DE LOCATION :", { ...L, top: top + 26.4, bold: true });
  const minutes = rentalDurationMinutes(d);
  const price = d.hourlyCents
    ? `${euros(d.hourlyCents / 100)} de l’heure, Total de ${euros(d.totalCents / 100)} pour ${durationLabel(minutes)}`
    : `Total de ${euros(d.totalCents / 100)} pour ${durationLabel(minutes)}`;
  t = paragraph(p1, kit, `Prix de la location : ${price}`, { ...L, top: t + 12 });
  paragraph(
    p1,
    kit,
    `Du ${frDate(d.start.date)} à ${frTime(d.start.time)} au ${frDate(d.end.date)} à ${frTime(d.end.time)}`,
    { ...L, top: t + 12 },
  );

  /* Page 2 : conditions (texte fixe du modèle) */
  const p2 = doc.addPage(A4);
  paragraph(p2, kit, "CONDITIONS DE LOCATION :", { x: 56.8, top: 57.2, size: 12, width: 481, align: "center", bold: true });
  const conditions: [string, string][] = [
    ["Conditions d’âge du conducteur apprentis et de permis de l’accompagnant :", "L’accompagnateur doit avoir un permis de conduire valide depuis au moins 5 ans. Le conducteur en apprentissage doit avoir au minimum 16 ans."],
    ["Utilisation du véhicule :", "Le véhicule loué est destiné uniquement à la conduite sous double commande, à des fins de formation. Toute utilisation à d’autres fins (transport de marchandises, course, etc.) est interdite."],
    ["Responsabilité en cas d’accident :", "En cas d’accident, le locataire s’engage à fournir immédiatement un rapport d’accident ainsi que les informations nécessaires à l’entreprise de location et aux autorités compétentes."],
    ["Responsabilité :", "Je m’engage à respecter toutes les législations locales et nationales relatives à la conduite et à l’accompagnement à la conduite. Je ne serai pas sous l'influence de l'alcool ou de substances stupéfiantes pendant la session."],
    ["Carburant :", "Le véhicule est remis avec le plein de carburant. Le locataire s’engage à rendre le véhicule avec le même niveau de carburant. Toute différence sera facturée au tarif de 4 euros le litre."],
    ["Entretien et réparation :", "Le locataire s'engage à informer l'entreprise de toute panne ou dommage survenu pendant la période de location. Le locataire est responsable de toute réparation causée par une mauvaise utilisation du véhicule."],
    ["Retour du véhicule :", "Le véhicule doit être retourné à l’endroit convenu, à l'heure spécifiée, dans le même état que lors de la prise en charge. Tout retard dans la restitution sera facturé."],
  ];
  t = 83;
  conditions.forEach(([title, body], i) => {
    p2.drawText(`${i + 1}.`, { x: 74.8, y: A4[1] - t - 12 * ASCENT, size: 12, font: kit.regular, color: BLACK });
    const afterTitle = paragraph(p2, kit, title, { x: 92.8, top: t, size: 12, width: 445, lineHeight: 13.7, bold: true });
    t = paragraph(p2, kit, body, { x: 92.8, top: afterTitle, size: 10, width: 445, lineHeight: 11.5 }) + 8;
  });
  top = Math.max(396.43, t + 10);
  rule(p2, top);
  t = paragraph(p2, kit, "DÉPÔT DE GARANTIE :", { x: 56.8, top: top + 26.4, size: 12, width: 481, bold: true });
  t = paragraph(
    p2,
    kit,
    "Un dépôt de garantie de 150€ est exigé au moment de la prise en charge du véhicule. Ce dépôt sera restitué au locataire après l’inspection du véhicule, sous réserve qu’il soit retourné dans les conditions prévues.",
    { x: 56.8, top: t, size: 10, width: 481, lineHeight: 11.5 },
  );
  top = Math.max(471.03, t + 12);
  rule(p2, top);
  t = paragraph(p2, kit, "SIGNATURES :", { x: 56.8, top: top + 26.5, size: 12, width: 481, bold: true });
  t = paragraph(
    p2,
    kit,
    "Le locataire certifie avoir pris connaissance des conditions de location et s’engage à respecter l’ensemble des obligations mentionnées ci-dessus.",
    { x: 56.8, top: t + 12, size: 10, width: 481, lineHeight: 11.5 },
  );
  const sigTop = Math.max(581.9, t + 35);
  const sig = (x: number, label: string) => {
    paragraph(p2, kit, [{ text: label, bold: true }, { text: " :" }], { x, top: sigTop, size: 12, width: 240 });
    paragraph(p2, kit, [{ text: "Date", bold: true }, { text: ` : ${frDate(d.signatureDate)}` }], { x, top: sigTop + 13.8, size: 12, width: 240 });
  };
  sig(56.8, "Signature du locataire");
  sig(344.8, "Signature de l’entreprise");
  placeImage(p2, kit.stamp, 344.3, sigTop + 66.3, 156.5, 57.7);
  return doc.save();
}

/* ------------------------------------------------ Attestation d'assurance */

export type InsuranceData = {
  client: { lastName: string; firstName: string };
  vehicle: { brand?: string | null; model?: string | null; registration?: string | null };
  signatory: string;
  policy: string;
  insurer: string;
  signatureDate: string;
};

export async function buildInsurancePdf(d: InsuranceData) {
  const { doc, kit } = await newDoc(`Attestation d'assurance - ${d.client.lastName} ${d.client.firstName}`);
  const p = doc.addPage(A4);
  const B = { x: 72.1, size: 12, width: 451, lineHeight: 13.8 };
  paragraph(p, kit, "ATTESTATION D’ASSURANCE", { x: 72.1, top: 72.6, size: 13.5, width: 451, align: "center", bold: true });
  paragraph(p, kit, "A FOURNIR PAR LES CANDIDATS LIBRES", { x: 72.1, top: 102, size: 12, width: 451, align: "center", bold: true });
  let t = paragraph(p, kit, `Je soussignée (2) ${d.signatory}, Agissant en qualité de (3) président,`, { ...B, top: 156.9 });
  t = paragraph(p, kit, "De (4) la société Go Permis sous le nom commercial Go Permis, 275 route de Seysses, 31100 Toulouse.", { ...B, top: t + 13.5 });
  t = paragraph(p, kit, "ATTESTE", { ...B, top: t + 13.6, align: "center", bold: true });
  t = paragraph(p, kit, `Que la garantie de la police d’assurance N° ${d.policy}. Souscrite par (5) ${d.insurer}`, { ...B, top: t + 12 });
  t = paragraph(
    p,
    kit,
    "Est, par dérogation partielle à l’article L.211-1 du code des assurances, des conditions Générales, étendues à la responsabilité civile de",
    { ...B, top: t + 12 },
  );
  t = paragraph(p, kit, `Mr/Mme, ${d.client.lastName.toUpperCase()} ${d.client.firstName}`, { ...B, top: t + 12 });
  t = paragraph(
    p,
    kit,
    "Candidat(e) au permis de conduire, à raison des dommages pouvant résulter d’accidents causés aux tiers y compris aux personnes se trouvant à l’intérieur du véhicule, à l’occasion du déroulement des épreuves de l’examen du permis de conduite,",
    { ...B, top: t + 12 },
  );
  const vehicle = [d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ");
  t = paragraph(p, kit, `${vehicle} immatriculée : ${d.vehicle.registration ?? ""}.`, { ...B, top: t + 12 });
  t = paragraph(p, kit, "La présente attestation est valable pour la journée de l'examen pratique de la conduite.", { ...B, top: t + 25.8 });
  paragraph(p, kit, `Fait à Toulouse le : ${frDate(d.signatureDate)}`, { ...B, top: Math.max(504.2, t + 41.2) });
  paragraph(p, kit, "Signature", { x: 326, top: 598.7, size: 12, width: 120, align: "center", bold: true });
  placeImage(p, kit.stamp, 311.6, 628.2, 164.8, 61.0);
  return doc.save();
}
