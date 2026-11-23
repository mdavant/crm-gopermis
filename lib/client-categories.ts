/** Catégories d'élèves (filière de formation). Liste ajustée d'après les dossiers de l'auto-école. */
export const CLIENT_CATEGORIES = [
  { id: "permis-b", label: "Formation permis B", color: "#3e7bfa" },
  { id: "heures-sup", label: "Heures supplémentaires", color: "#12a594" },
  { id: "candidat-libre", label: "Candidat libre", color: "#e8833a" },
  { id: "vtc", label: "VTC", color: "#8e4ec6" },
] as const;

export type ClientCategoryId = (typeof CLIENT_CATEGORIES)[number]["id"];
export const CLIENT_CATEGORY_IDS = CLIENT_CATEGORIES.map((c) => c.id) as [ClientCategoryId, ...ClientCategoryId[]];
export const categoryOf = (id?: string | null) => CLIENT_CATEGORIES.find((c) => c.id === id) ?? null;

/** Statuts considérés « en cours » (hors terminés et archivés). */
export const isOngoing = (status: string) => status !== "Terminé" && status !== "Archivé";
