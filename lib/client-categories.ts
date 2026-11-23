/** Catégories d'élèves (filières), alignées sur l'organisation du Drive de l'auto-école. */
export const CLIENT_CATEGORIES = [
  { id: "candidat-libre", label: "Candidat libre", color: "#e8833a" },
  { id: "auto-ecole", label: "Inscrit en auto-école", color: "#3e7bfa" },
  { id: "remise-a-niveau", label: "Remise à niveau", color: "#12a594" },
  { id: "examen-pratique", label: "Examen pratique", color: "#e5484d" },
  { id: "vtc", label: "VTC", color: "#8e4ec6" },
] as const;

export type ClientCategoryId = (typeof CLIENT_CATEGORIES)[number]["id"];
export const CLIENT_CATEGORY_IDS = CLIENT_CATEGORIES.map((c) => c.id) as [ClientCategoryId, ...ClientCategoryId[]];
export const categoryOf = (id?: string | null) => CLIENT_CATEGORIES.find((c) => c.id === id) ?? null;

/** Statuts considérés « en cours » (hors terminés et archivés). */
export const isOngoing = (status: string) => status !== "Terminé" && status !== "Archivé";
