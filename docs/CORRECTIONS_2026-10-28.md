# Stabilisation de la version GitHub 1a1c39e

La version Google reste la base visuelle. Aucun changement du fichier app/globals.css. L'ancien shell n'enveloppe plus une seconde fois l'accueil qui dispose déjà de sa navigation. Le travail local antérieur reste sauvegardé dans un stash distinct ; il n'a pas été fusionné en bloc.

## Corrections

- Suppression du doublon hashPassword et rétablissement des imports/types et endpoints des clients paginés, des coordonnées, de la connexion et des sessions.
- Connexion commune aux écrans existants et nouveaux, jeton d'aperçu temporaire dans sessionStorage avec secours mémoire, session HttpOnly en production. Les identifiants affichés et le mot de passe prérempli ont été retirés. Aucun compte ou mot de passe par défaut n'est recréé.
- Validation stricte d'Origin, limitation des échecs de connexion, changement de mot de passe avec ancien mot de passe et révocation des sessions. Les détails internes des erreurs ne sont plus renvoyés au navigateur.
- PostgreSQL configuré ne bascule plus silencieusement vers PGlite. Aperçu PGlite direct persistant, sans serveur socket supplémentaire ; pg_trgm chargé pour les migrations existantes.
- Suppression des notifications inventées, des affirmations de véhicules vérifiés et de dossiers NEPH manquants. Les cartes restent présentes avec des indications honnêtes. Google Calendar est explicitement non connecté, sans simulation de synchronisation.
- Les filtres du calendrier utilisent les statuts réels confirmé/réalisé ; les nombres fictifs des catégories sont remplacés par les données disponibles ou une absence de valeur.
- Les compteurs d'accueil sont calculés en SQL, indépendamment de la recherche affichée. Les métadonnées de planning sont masquées sans le droit de lecture correspondant.
- L'action clients/delete conserve sa compatibilité technique mais archive la fiche, ses liens et ses historiques. Le libellé et la confirmation indiquent l'archivage.
- Migration 006 : catalog.write est attribué au seul rôle technique initial. clients.write n'autorise plus à changer les prix. Les prix vendus restent des snapshots immuables. L'audit des offres accepte leurs identifiants textuels sans les insérer dans une colonne UUID.
- Modification de ressource sous verrou : refus d'archiver avec des occupations futures ; refus de changer le modèle d'un véhicule déjà associé à des séances ; erreur claire pour ressource absente.
- Les erreurs d'action sur une fiche client ne remplacent plus toute la fiche par une erreur « introuvable ».
- Lockfile restauré, overrides PostCSS/sharp conservés.

## Vérification et limites

Les résultats exécutés figurent en tête de VERIFICATIONS.md. Les tests utilisent des bases et identités fictives isolées. Aucun client de production n'a été importé ou supprimé ; aucun déploiement public ni communication externe effectué.

Cette stabilisation n'ajoute pas la gestion des utilisateurs, le thème sombre ou le suivi Shine précédemment préparés dans le travail local mis de côté. Le marquage Shine reste à réintégrer conformément à la décision métier : trace seule, aucun crédit d'heures.

L'annuaire principal de la nouvelle interface conserve sa liste de 100 résultats et le planning une lecture plafonnée à 1000 ; les endpoints de recherche paginée restent accessibles aux pages existantes. La grille principale conserve le créneau visuel 08 h–20 h et les calculs locaux du navigateur : ce n'est pas une règle d'ouverture et une validation supplémentaire des séances hors plage, de nuit et sur les changements d'heure reste nécessaire. Les URL existantes et l'accueil conservent deux architectures de navigation ; seule leur superposition est corrigée ici. Les tests navigateur couvrent le rendu mobile, sans attester une validation ergonomique exhaustive de toutes les modales et dimensions.
