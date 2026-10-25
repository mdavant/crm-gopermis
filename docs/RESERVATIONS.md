# Réservations et réalisation — incrément 0.3

## Décision métier reçue le 25 octobre 2026

GoPermis autorise la planification sans crédit. La réalisation exige un crédit suffisant. Une réservation ne débite ni ne réserve financièrement les heures : plusieurs séances peuvent être planifiées au-delà du crédit courant ; chaque réalisation recontrôle le journal sous verrou. Aucun découvert n'est autorisé. Cette décision est initialisée dans `scheduling_policy.credit_policy=credit_on_completion` par la migration 003.

La politique V2 des paiements partiels reste **provisoire** : crédit à règlement intégral, bonus uniquement après un paiement unique couvrant la prestation. Aucun changement tarifaire, no-show, annulation facturée, remboursement ou clôture automatique n'est introduit.

## Parcours

1. Compte possédant les permissions nécessaires : Ressources → ajouter les véhicules physiques (modèle + identifiant interne réel) et moniteurs. Aucun seed de ressources GoPermis supposées.
2. Configurer les indisponibilités ponctuelles. Une indisponibilité qui chevauche une séance est refusée ; elle n'annule jamais la séance. La levée conserve l'enregistrement et l'audit.
3. Fiche client → prestation active → Réserver. Le modèle vient du snapshot accepté ; GoPermis exige un moniteur actif ; Personnel exige le nom et la date du permis de l'accompagnateur et refuse un moniteur/RS3.
4. Saisir début et fin : fuseau du navigateur indiqué explicitement, instants transmis avec offset, affichage Europe/Paris. Les dates locales inexistantes au changement d'heure sont refusées par le formulaire ; la durée est calculée entre instants, en minutes entières. Pour les heures locales répétées en automne, vérifier l'instant choisi (le navigateur retient une occurrence) : pas d'éditeur avancé des deux occurrences dans cet incrément.
5. « Vérifier et confirmer » crée directement une réservation **confirmée**, et non une simple demande. Les conflits du client, du véhicule, du moniteur et leurs indisponibilités sont bloquants.
6. Après l'heure de fin, « Marquer réalisée » demande une confirmation humaine, recontrôle les droits et le crédit, puis inscrit réalisation, débit, auteur/date et audit dans une même transaction. Le nouvel historique et le solde sont relus.

Les séances passées peuvent être saisies pour rattrapage administratif. Aucun débit n'est possible avant leur heure de fin. L'ancienneté de permis se calcule à la date parisienne de la séance. La fonction existante est conservatrice pour le 29 février : elle accepte le 1er mars de la cinquième année ; une date d'évaluation invalide est maintenant refusée.

## Modèle et garanties

`vehicle_model` reste un modèle tarifaire. `vehicle` est une ressource physique. `instructor` est une ressource de planning distincte de `app_user` : aucune création de compte ou attribution de rôle implicite. `booking` référence prestation, client, véhicule physique, moniteur éventuel, intervalle, durée, statut, auteur, date, clé d'idempotence, réalisation et accompagnateur personnel éventuel.

`calendar_occupancy` représente, dans un espace commun, les réservations et indisponibilités. Trois contraintes d'exclusion GiST avec `btree_gist` empêchent les chevauchements par véhicule/moniteur/client. Les intervalles `[début,fin[` autorisent deux séances adjacentes. La migration requiert une installation autorisant l'extension (à faire préparer par l'administrateur sur un hébergement managé).

La couche applicative verrouille la prestation puis le client, le véhicule et le moniteur, dans cet ordre ; elle relit état et ressources dans la transaction. Paiements, confirmations et réalisations sérialisent leurs calculs d'heures sur la même prestation. Les contraintes d'exclusion protègent aussi les écritures concurrentes indépendamment de ces verrous applicatifs.

Une réalisation prend le verrou de prestation puis celui de la séance. Si elle est déjà réalisée, elle retourne le résultat sans nouveau débit. `hour_ledger.booking_id` est unique, référencé et obligatoire pour un mouvement `session`, toujours négatif. Le solde est uniquement la somme du journal : aucun solde mutable ajouté. Les journaux restent append-only. Un trigger interdit de supprimer une réservation, de changer ses ressources, son intervalle ou de revenir sur sa réalisation. Les erreurs métier entraînent un rollback complet.

L'accès direct SQL reste une capacité d'administration : l'API est la voie d'écriture métier. Le rôle applicatif de production devra être distinct du propriétaire des migrations et restreint ; les comptes Docker locaux servent au développement/test, pas de modèle de moindre privilège pour la production.

## API et droits

Toutes les écritures vérifient session, permission et Origin ; les entrées passent par Zod et les requêtes sont paramétrées.

| Endpoint                                                      | Permission          |
| ------------------------------------------------------------- | ------------------- |
| GET `/api/resources`, GET `/api/bookings?clientId=<uuid>`     | `schedule.read`     |
| POST `/api/resources`, `/api/resources/archive`               | `resources.write`   |
| POST `/api/unavailability`, `/api/unavailability/:id/release` | `resources.write`   |
| POST `/api/services/:id/bookings`                             | `schedule.write`    |
| POST `/api/bookings/:id/complete`                             | `sessions.complete` |

Les nouvelles permissions sont attribuées uniquement à `technical_admin`. Les autres profils et le rôle moniteur ne reçoivent aucun droit supplémentaire. La matrice organisationnelle reste à faire valider avant ouverture à l'équipe.

L'API d'indisponibilité accepte véhicule, moniteur ou client ; l'écran Ressources expose véhicule et moniteur. Les indisponibilités client restent configurables via l'API protégée. La liste planning affiche les 500 dernières séances par date de début, avec avertissement de limite ; la fiche filtre par client. Pas encore de calendrier graphique, pagination planning, modification/annulation de séance ou correction de réalisation : ces transitions nécessitent un lot distinct et les arbitrages métier correspondants. Pas d'horaires récurrents, de temps de battement ni de documents vérifiés automatiquement ; seules les indisponibilités explicites sont contrôlées.
