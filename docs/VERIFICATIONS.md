# Correctif connexion — 25 octobre 2026

Reprise du commit GitHub `49fc411` (identifiant + PGlite). Connexion par identifiant conservée. Suppression des mots de passe embarqués, du formulaire prérempli, de la réinitialisation des comptes et des données fictives automatiques ; base d'aperçu persistante, initialisation par formulaire en aperçu privé, verrouillage transactionnel du premier compte, erreurs HTML/JSON distinguées, vérification d'origine stricte et lockfile restauré.

Contrôles du correctif : typecheck et lint réussis ; 13 tests unitaires réussis (dont gestion HTML, JSON et hash invalide) ; build normal réussi ; scénario HTTP d'aperçu réussi avec redémarrage, compte/session conservés et base PostgreSQL indisponible sans repli ; suites HTTP PGlite et PostgreSQL natif avec concurrence/restauration réussies ; navigateur métier desktop/mobile réussi ; audit complet 0 vulnérabilité. Les détails et la commande de test navigateur du premier compte sont dans [CONNEXION](CONNEXION.md).

Ces vérifications concernent le code exécuté ici. La synchronisation et l'exécution dans la session AI Studio du responsable métier ne sont pas directement accessibles à cet environnement.

---

## Vérifications du lot V3 précédent

# Vérifications de la reprise 0.3 — 25 octobre 2026

Ces résultats ont été obtenus dans l'environnement cloud actuel, à partir de l'archive V2. Ils remplacent le compte rendu de l'ancien environnement Work. Aucun client ni secret de production utilisé.

| Commande / vérification                                           | Résultat observé                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm ci --cache /workspace/.npm`                                  | Réussi, lockfile réinstallé après ajout de Playwright                                                         |
| `npm run typecheck`                                               | Réussi                                                                                                        |
| `npm run lint`                                                    | Réussi, aucune erreur/alerte ESLint                                                                           |
| `npm test`                                                        | 10 tests réussis : 8 V2 + 2 groupes de cas limites calendrier/durée/permis                                    |
| `npm run build`                                                   | Réussi, Next 15.5.28 ; commandes normales, sans adaptateur RSS                                                |
| `npm run test:integration`                                        | 1 scénario HTTP étendu réussi sur PGlite, avec btree_gist, pool 1                                             |
| `npm run test:native`                                             | Même scénario sur PostgreSQL 17.11 natif, pool 10 ; concurrence et restauration réussies                      |
| `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser` | Parcours navigateur réussi sur base native jetable, desktop 1440×1000 et contrôle mobile 390×844              |
| `npm audit --omit=dev --audit-level=high`                         | 0 vulnérabilité signalée                                                                                      |
| `npm audit --audit-level=high`                                    | 0 vulnérabilité signalée, dépendances de développement incluses                                               |
| `npm run dev:db`                                                  | Base créée puis commande réexécutée sans écrasement ; migrations appliquées puis réexécutées                  |
| Docker / Compose                                                  | Image construite, DB saine, migrations exécutées deux fois, serveur démarré, parcours HTTP fonctionnel réussi |

## Vérification fonctionnelle et native

Le scénario HTTP conserve les assertions V2 : authentification, refus anonyme, révocation des droits, Origin, validation, doublons simples, recherche sans accents, restrictions RS3/VTC, plusieurs prestations, paiements/bonus/retries, snapshots, notes et journaux immuables.

Il ajoute : ressources fictives explicitement étiquetées TEST, intervalles invalides, compatibilité modèle/accompagnement, cinq ans de permis, indisponibilités véhicule/moniteur/client, levée répétée, conflits sur chacune des trois ressources, réservation répétée avec la même clé, rejet d'une clé réutilisée différemment, créneaux adjacents, réservation sans crédit, refus de réalisation sans crédit avec rollback (statut conservé et journal vide), paiement, réalisation et retry, crédit résultant exact, audit unique, séance future non réalisable, refus d'archivage d'une ressource occupée, prestation terminée, protection des réservations historiques et révocation immédiate des nouveaux droits.

Sur PostgreSQL natif uniquement :

- Deux confirmations concurrentes de prestations/clients différents sur le même véhicule/moniteur : une seule création, l'autre 409.
- Trois validations concurrentes d'une même séance : un débit et un événement d'audit.
- Deux séances différentes réalisées en concurrence avec seulement une heure de crédit : une réussite, un refus 422, solde final nul.
- Paiement simultané avec la même clé : un paiement.
- Contraintes d'exclusion testées directement avec deux connexions et transactions SQL distinctes, sans les verrous applicatifs : pour véhicule, moniteur et client, la seconde écriture chevauchante est rejetée avec `23P01` et la contrainte attendue.

Le runner crée puis supprime son propre conteneur jetable ; il ne réinitialise jamais la base de développement ou une URL de production. Les migrations sont appliquées deux fois dans chaque scénario. Il effectue un vrai `pg_dump -Fc`, restaure dans une autre base avec `pg_restore --exit-on-error`, compare les nombres d'enregistrements de migrations/séances/journal/paiements/audit/occupations et vérifie les protections historiques après restauration. Cela prouve le mécanisme sur des données de test, pas une procédure opérationnelle de sauvegarde de production.

## Navigateur et inspection visuelle

Playwright + Chromium système, fuseau Europe/Paris. Le scénario remplit réellement les formulaires : connexion → véhicule → moniteur → client → prestation → réservation sans crédit → erreur de réalisation → paiement → réalisation → journal et audit. Navigation et modale mobile contrôlées, absence de débordement horizontal, tabulations contenues dans la modale, fermeture Échap, aucune erreur JavaScript navigateur.

Captures générées dans `artifacts/browser/` (ignorées), puis inspectées : fiche desktop, fiche mobile, ressources mobile, modale réservation mobile. L'inspection a conduit à corriger les espacements des cartes, les boutons secondaires et les boutons principaux comprimés/cachés par les anciennes règles mobiles. Les captures sont prises en haut de page pour éviter les artefacts de capture pleine page des éléments fixes.

Limites : parcours de saisie complet effectué en desktop ; mobile vérifié à une largeur représentative, navigation, présentation et modale, pas sur tous les appareils ni lecteurs d'écran. Pas de validation sur iOS/Safari, pas d'audit d'accessibilité exhaustif, pas de test de charge.

## Docker et réseau

Dockerfile multi-stage construit ; Compose lancé sous un projet de test isolé, port loopback distinct, secrets aléatoires temporaires hors dépôt, base `postgres:17-alpine`. Migrations réexécutées, compte de test créé par le script fourni. Smoke HTTP : page, refus anonyme, connexion, client, prestation, ressources, réservation sans crédit, refus de réalisation, paiement, réalisation puis retry, journal unique et solde nul. Les services et le volume de ce projet de validation sont supprimés après contrôle ; la base locale de développement est distincte.

L'essai initial de build Compose n'accédait pas au registre npm depuis le conteneur. Diagnostic puis correction : transmettre le proxy standard et son certificat approuvé par un secret BuildKit `npm_ca`, avec résolution du proxy adaptée à cette infrastructure. Build Compose ensuite réussi. Aucune désactivation de TLS ou d'intégrité des paquets. L'autorité n'est pas intégrée à l'image. npm signale la fin de maintenance d'ESLint 9.39.5 ; pas de mise à jour majeure du lint dans ce lot.

Le téléchargement de Chromium Playwright a été refusé par la politique réseau sur `cdn.playwright.dev`. Aucun élargissement réseau nécessaire : Chromium système disponible utilisé avec succès. Sur une machine sans navigateur système, installer le navigateur via une destination autorisée avant `test:browser`.

## Portée

Serveur de développement et PostgreSQL local démarrés et interrogés dans cette instance. Aucun déploiement public ni communication externe. Aucun compte par défaut livré ; le compte technique doit être créé avec un secret fourni de manière sécurisée. Les sauvegardes, HTTPS de staging/production, rôle SQL de moindre privilège et matrice de droits restent des travaux opérationnels distincts.

La recherche clients V2 reste limitée à 2 000 clients / 100 résultats ; le planning à 500 dernières séances (filtrable par client). Les limites fonctionnelles sont détaillées dans [RESERVATIONS](RESERVATIONS.md). Les conteneurs et processus vivants ne doivent pas être supposés restaurés dans une nouvelle tâche cloud ; les instructions réutilisables relancent la base et le serveur.
