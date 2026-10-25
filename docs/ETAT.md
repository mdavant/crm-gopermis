# Reprise 0.3 — 25 octobre 2026

Archive V2 extraite dans le dépôt initialement sans commit, aucun AGENTS.md trouvé. Socle réellement validé ici sans adaptateur RSS. Next 15.5.28, React 19.1.7 et overrides PostCSS/sharp conservés ; seul Playwright 1.64.1 ajouté aux dépendances de développement pour rendre le parcours navigateur reproductible.

Incrément livré : migration 003, ressources physiques et moniteurs distincts des utilisateurs, indisponibilités explicites, réservations transactionnelles, contraintes d'exclusion PostgreSQL, réalisation idempotente avec journal et audit, interface de configuration et séances sur fiche client / planning. La validation d'ancienneté du permis a été corrigée : refus des dates d'évaluation impossibles et des permis datés d'une année très lointaine, que la comparaison lexicographique pouvait accepter.

Décision GoPermis : planifier sans crédit, bloquer la réalisation si crédit insuffisant. La règle des paiements partiels reste provisoire. Aucun tarif, rôle métier ou droit moniteur supplémentaire inventé. Détails : [RESERVATIONS](RESERVATIONS.md). Résultats exécutés : [VERIFICATIONS](VERIFICATIONS.md).

Le parcours vertical existe maintenant ; ne pas extrapoler à un planning complet. Annulations, déplacements de séances, corrections financières, créneaux récurrents, pagination, documents, interface moniteur dédiée, administration des rôles/tarifs et intégrations restent à développer. Aucun déploiement de production.

---

# Transmission V2 historique (avant la reprise 0.3)

Les constats et limites ci-dessous concernent l'ancien environnement Work ; les résultats actuels sont ceux des documents ci-dessus.

# Audit et décisions — 25 octobre 2026

## État de l'archive reçue

Next.js 15.5.6, React 19.1.0, TypeScript ; seulement sept fichiers applicatifs/configuration, pas de lockfile, serveur de données, authentification ou tests. La fiche client était reliée à des tableaux mock. La plupart des rubriques affichaient le même dashboard fictif ; création, recherche globale et actions rapides inactives. La fiche ne gérait qu'une prestation par personne, affichait un résumé IA constant et des valeurs non définies pour les clients sans prestation.

## Choix appliqués

Conserver Next et les styles orange/blanc ; composants séparés pour fiche et modale. API REST /api derrière une couche applicative serveur et un domaine tarifaire pur. Pilote pg et migrations SQL versionnées plutôt qu'un ORM supplémentaire : transactions et contraintes lisibles, modèle encore réduit. Application de migrations sérialisée par advisory lock.

Données centrales : utilisateurs, sessions, rôles/permissions, clients, types de prestation, modèles de véhicule, versions tarifaires, offres, prestations, paiements, journal d'heures, notes, audit. Les modèles ne sont pas des véhicules physiques : ces derniers viendront avec le planning. Aucune fausse ressource physique créée.

Catalogue initial fourni par le responsable métier : Clio manuelle 25/35 €, Clio automatique 30/45 €, RS3 GoPermis 70 €, aucune combinaison RS3 personnel. Date de début technique de seed 2026-01-01 pour rendre la grille disponible, sans prétendre décrire l'historique commercial réel. VTC signalé comme devis requis, aucune tarification inventée.

Permissions granulaires stockées dans les tables de rôles ; profils technical_admin/manager/administration ont les permissions de ce premier périmètre. Instructor est réservé sans accès par défaut. Attribution réelle des rôles et matrice organisationnelle à valider avant déploiement ; gestion des utilisateurs par interface à venir. Les paiements et l'audit ont leurs propres guards. Pas de compte ni de mot de passe par défaut.

Sessions aléatoires de 256 bits, seul hash SHA-256 en base, expiration 8 h, cookie HttpOnly / SameSite Lax / Secure en production. Vérification d'Origin sur les écritures, requêtes paramétrées, validation Zod, limitation des tentatives par email en base. Le reverse proxy devra ajouter une limitation par IP et les protections opérationnelles usuelles. Pas de MFA ni de récupération de compte dans cet incrément.

Prix et montants en centimes, durées en minutes. Pas de champ mutable de solde. Paiement et crédit d'heures sont transactionnels ; retry avec même requestId ne duplique pas un paiement. Le snapshot et les journaux sont protégés par triggers contre les modifications ordinaires. Des écritures de correction restent à implémenter ; aucune suppression exposée.

## À poursuivre

1. Répéter les migrations et tests de concurrence sur PostgreSQL natif, tester restauration, configurer staging HTTPS.
2. Compléter parcours UI : modification client, état/fin de prestation, détail des mouvements, accessibilité complète et validation visuelle desktop/mobile.
3. Administration des tarifs/offres et des droits, détection de doublons à grande échelle, recherche SQL paginée et indexée.
4. Véhicules physiques, moniteurs, disponibilités, réservation avec contrainte d'exclusion et consommation transactionnelle/idempotente des heures.
5. Documents et règles configurables, puis Google/WhatsApp lorsque les accès seront fournis.

Ce lot n'est pas un CRM terminé ni un système prêt à recevoir toutes les données réelles. Pas de planning, documents, moniteur mobile, communications ou IA opérationnels. Les anciens boutons décoratifs sont retirés.

## Dépendances

Next mis à jour vers 15.5.28 et React vers 19.1.7 après avertissement de vulnérabilité de l'ancienne version. Avis officiel : https://nextjs.org/blog/nextjs-security-update-october-14-2026. PostCSS 8.5.31 et sharp 0.35.5 sont imposés par overrides pour corriger les alertes transitives identifiées par npm audit. Versions effectives et dépendances transitives verrouillées dans package-lock.json.

## Particularités de vérification Work

Le Node de cet environnement ne peut pas lire certaines informations système (RSS / interfaces réseau). Build exécuté avec un petit adaptateur temporaire RSS extérieur au projet ; aucun contournement ajouté au code livré. Serveur démarré avec hostname explicite. Docker et PostgreSQL natif indisponibles ; impossible de changer d'utilisateur dans le sandbox pour démarrer un serveur PostgreSQL binaire. Les tests d'intégration utilisent donc PGlite isolé. Cette limite doit rester explicite.
