/**
 * Catalogue des permissions GoPermis : modules → accès principal → sous-accès.
 * Partagé par le serveur (contrôle) et le panel admin (affichage).
 * Chaque permission peut en exiger d'autres (`requires`) : cocher un sous-accès
 * coche son accès parent, décocher un accès retire ses sous-accès.
 */
export type PermissionDef = {
  key: string;
  label: string;
  description: string;
  requires?: string[];
  /** Restriction (réduit un accès au lieu d'en donner un). */
  restriction?: boolean;
  /** Réservé : ne s'attribue qu'en connaissance de cause. */
  sensitive?: boolean;
};

export type PermissionModule = {
  id: string;
  label: string;
  description: string;
  permissions: PermissionDef[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "planning",
    label: "Planning & séances",
    description: "Agenda des leçons, réservations et suivi des heures.",
    permissions: [
      { key: "schedule.read", label: "Voir le planning", description: "Consulter l'agenda, les séances et les disponibilités." },
      {
        key: "schedule.write",
        label: "Planifier des séances",
        description: "Créer, déplacer et annuler des séances de conduite.",
        requires: ["schedule.read"],
      },
      {
        key: "sessions.complete",
        label: "Valider les séances réalisées",
        description: "Marquer une séance comme effectuée et décompter les heures.",
        requires: ["schedule.read"],
      },
      {
        key: "planning.own_only",
        label: "Limité à ses propres séances",
        description: "Moniteur : ne peut planifier qu'à son nom, sans inscrire un autre moniteur.",
        requires: ["schedule.read"],
        restriction: true,
      },
    ],
  },
  {
    id: "clients",
    label: "Élèves & dossiers",
    description: "Fiches élèves, prestations et historique.",
    permissions: [
      { key: "clients.read", label: "Consulter les élèves", description: "Voir la liste et les fiches élèves." },
      {
        key: "clients.write",
        label: "Créer et modifier les élèves",
        description: "Ajouter un élève, modifier ses coordonnées et ses notes.",
        requires: ["clients.read"],
      },
      {
        key: "services.write",
        label: "Vendre des prestations",
        description: "Ajouter une formule ou un forfait au dossier d'un élève.",
        requires: ["clients.read"],
      },
      {
        key: "clients.archive",
        label: "Archiver des élèves",
        description: "Retirer un élève de la liste active (réversible par un admin).",
        requires: ["clients.read"],
      },
    ],
  },
  {
    id: "payments",
    label: "Paiements",
    description: "Encaissements et soldes d'heures.",
    permissions: [
      {
        key: "payments.read",
        label: "Voir les paiements",
        description: "Montants dus, réglés et soldes d'heures des élèves.",
        requires: ["clients.read"],
      },
      {
        key: "payments.write",
        label: "Encaisser un paiement",
        description: "Enregistrer un règlement (carte, virement, espèces).",
        requires: ["payments.read"],
      },
    ],
  },
  {
    id: "documents",
    label: "Documents & Drive",
    description: "Pièces des dossiers élèves et espace documentaire.",
    permissions: [
      {
        key: "documents.read",
        label: "Consulter les documents élèves",
        description: "Ouvrir les pièces du dossier (NEPH, justificatifs…).",
        requires: ["clients.read"],
      },
      {
        key: "documents.write",
        label: "Ajouter des documents élèves",
        description: "Déposer et classer des pièces dans les dossiers.",
        requires: ["documents.read"],
      },
      { key: "drive.read", label: "Accéder au Drive", description: "Parcourir et télécharger les fichiers partagés." },
      {
        key: "drive.write",
        label: "Ajouter dans le Drive",
        description: "Créer des dossiers, importer, renommer et déplacer des fichiers.",
        requires: ["drive.read"],
      },
      {
        key: "drive.delete",
        label: "Supprimer dans le Drive",
        description: "Supprimer définitivement fichiers et dossiers.",
        requires: ["drive.write"],
      },
    ],
  },
  {
    id: "catalog",
    label: "Tarifs, véhicules & équipe",
    description: "Catalogue commercial et ressources de conduite.",
    permissions: [
      {
        key: "catalog.write",
        label: "Modifier tarifs et offres",
        description: "Changer les prix, créer des modèles et des forfaits.",
      },
      {
        key: "resources.write",
        label: "Gérer véhicules et moniteurs",
        description: "Ajouter, archiver, bloquer des créneaux d'indisponibilité.",
        requires: ["schedule.read"],
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    description: "Comptes, sécurité et traçabilité.",
    permissions: [
      { key: "audit.read", label: "Consulter l'historique", description: "Journal des actions (qui a fait quoi, quand)." },
      {
        key: "users.manage",
        label: "Gérer les utilisateurs",
        description: "Créer des comptes, réinitialiser les mots de passe, attribuer des permissions.",
        sensitive: true,
      },
      {
        key: "admin.full",
        label: "Administrateur complet",
        description: "Tous les droits, présents et futurs.",
        sensitive: true,
      },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.permissions);
const BY_KEY = new Map(ALL_PERMISSIONS.map((p) => [p.key, p]));
export const KNOWN_PERMISSION_KEYS = new Set(ALL_PERMISSIONS.map((p) => p.key));

/** Ajoute récursivement les accès requis. */
export function withRequirements(keys: Iterable<string>) {
  const out = new Set<string>();
  const visit = (k: string) => {
    if (out.has(k)) return;
    out.add(k);
    for (const r of BY_KEY.get(k)?.requires ?? []) visit(r);
  };
  for (const k of keys) visit(k);
  return out;
}

/** Retire un accès et tout ce qui en dépend. */
export function withoutDependents(keys: Iterable<string>, removed: string) {
  const out = new Set(keys);
  out.delete(removed);
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of [...out]) {
      if ((BY_KEY.get(k)?.requires ?? []).some((r) => !out.has(r))) {
        out.delete(k);
        changed = true;
      }
    }
  }
  return out;
}

export type RolePresetId = "admin" | "manager" | "secretary" | "instructor" | "custom";

export const ROLE_PRESETS: { id: RolePresetId; label: string; hint: string; permissions: string[] }[] = [
  { id: "admin", label: "Administrateur", hint: "Tous les droits", permissions: ["admin.full"] },
  {
    id: "manager",
    label: "Responsable",
    hint: "Gestion complète sauf comptes",
    permissions: [
      "schedule.write", "sessions.complete", "clients.write", "services.write", "clients.archive",
      "payments.write", "documents.write", "drive.delete", "catalog.write", "resources.write", "audit.read",
    ],
  },
  {
    id: "secretary",
    label: "Secrétariat / accueil",
    hint: "Élèves, planning, encaissements",
    permissions: ["schedule.write", "clients.write", "services.write", "payments.write", "documents.write", "drive.write"],
  },
  {
    id: "instructor",
    label: "Moniteur",
    hint: "Ses séances et ses élèves",
    permissions: ["schedule.write", "planning.own_only", "sessions.complete", "clients.read", "documents.read", "drive.read"],
  },
  { id: "custom", label: "Personnalisé", hint: "À la carte", permissions: [] },
];

export function presetPermissions(id: string) {
  return [...withRequirements(ROLE_PRESETS.find((p) => p.id === id)?.permissions ?? [])];
}
