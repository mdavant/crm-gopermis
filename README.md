# GoPermis CRM — 0.3

CRM Next.js / React / TypeScript / PostgreSQL. Clients → plusieurs prestations → plusieurs séances, prix acceptés immuables, paiements déjà reçus, journal d'heures et audit. Aucun client de production, véhicule réel supposé ou moniteur réel n'est fourni.

## Aperçu AI Studio et connexion

Pour travailler sur l'interface : `npm ci`, puis `npm run dev`. Sans URL PostgreSQL configurée, l'aperçu de développement utilise une base PGlite persistante. Au premier lancement sans compte, créer l'accès administrateur depuis le formulaire « Créer votre accès ». Aucun mot de passe par défaut n'est livré. Les comptes existants ne sont jamais réinitialisés au démarrage. Voir [Connexion et aperçu](docs/CONNEXION.md) pour la configuration, la persistance et les vérifications.

## Développement

Node 24, npm et PostgreSQL 17. Utiliser le checkout existant ; chaque tâche cloud est déjà isolée, pas de worktree supplémentaire nécessaire.

```bash
npm ci
# Option locale avec Docker : crée .env.local seulement s'il est absent,
# démarre PostgreSQL sur loopback 55433, volume gopermis_dev_data.
npm run dev:db
node --env-file=.env.local scripts/migrate.mjs
npm run dev -- --hostname 0.0.0.0
```

Pour une base existante, copier `.env.example` vers `.env.local` sans écraser de configuration, renseigner `DATABASE_URL` et `APP_ORIGIN`. Ne pas utiliser `dev:db` pour gérer une base personnalisée. Les scripts Node nécessitent explicitement `--env-file=.env.local` ; Next le charge lui-même.

Aucun compte par défaut. Pour PostgreSQL, fournir **localement** `BOOTSTRAP_IDENTIFIER` (ou `BOOTSTRAP_EMAIL`), `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD` (secret unique de 14 caractères minimum) puis lancer :

```bash
node --env-file=.env.local scripts/create-user.mjs
```

Ne jamais commiter les secrets ou les mettre dans une commande historisée. Le compte bootstrap a le rôle technique. Les données de test navigateur/HTTP sont créées uniquement dans des bases jetables séparées.

## Parcours livré

Connexion → client → prestation → réservation confirmée avec véhicule/moniteur → réalisation après la fin → un seul débit d'heures → historique actualisé. Configuration des ressources et indisponibilités, liste planning et séances de la fiche client, erreurs de conflits côté serveur.

**Arbitrage GoPermis reçu le 25/10/2026 : planification autorisée sans crédit ; réalisation interdite sans crédit suffisant.** La règle V2 de crédit seulement à paiement intégral demeure provisoire. Les paiements n'entraînent aucun débit bancaire. Les prix et offres restent en base et ne recalculent jamais les prestations vendues. Aucun tarif VTC inventé.

Les nouvelles permissions sont réservées à `technical_admin`, sans extension silencieuse des droits métier/moniteur. La matrice organisationnelle reste à approuver. Voir [le fonctionnement et les limites des réservations](docs/RESERVATIONS.md).

## Vérification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm run test:native
# Navigateur : installer Chromium Playwright une fois, ou utiliser Chromium système.
npx playwright install chromium
npm run test:browser
# Variante avec Chromium installé :
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm audit --omit=dev --audit-level=high
```

Le build doit précéder les tests HTTP/navigateur. Arrêter le serveur `dev` avant le build : ils partagent `.next`. PGlite conserve la voie rapide, pool limité à une connexion. `test:native` crée un conteneur PostgreSQL 17 jetable, vérifie les parcours HTTP, les écritures concurrentes et une restauration pg_dump/pg_restore. `test:browser` utilise également une base jetable, le serveur de production local et Playwright ; captures dans `artifacts/browser/` (ignorées). Ces runners n'utilisent ni ne réinitialisent `DATABASE_URL`. Ne pas lancer les suites HTTP natives/PGlite simultanément (port serveur 3100 partagé).

Les contrôles réellement exécutés et leurs limites sont dans [VERIFICATIONS](docs/VERIFICATIONS.md). Aucune validation de production ne se déduit de ces tests.

## Docker Compose

Définir `POSTGRES_PASSWORD` et `APP_ORIGIN` dans un fichier privé extérieur au dépôt ou l'environnement. Le mot de passe doit être encodé dans une URL PostgreSQL ; utiliser un secret aléatoire sûr pour les URL. Ne pas afficher `docker compose config` avec de vrais secrets.

```bash
docker compose build
docker compose up -d db
docker compose run --rm app npm run db:migrate
# Fournir BOOTSTRAP_* de façon sécurisée au premier démarrage.
docker compose run --rm -e BOOTSTRAP_EMAIL -e BOOTSTRAP_NAME -e BOOTSTRAP_PASSWORD app npm run user:create
docker compose up -d app
```

Le port applicatif Compose reste lié à loopback. En production, reverse proxy HTTPS obligatoire pour les cookies Secure. Dans un environnement derrière un proxy TLS, transmettre les build args standards HTTP_PROXY/HTTPS_PROXY et, si nécessaire, un secret BuildKit `npm_ca` contenant le certificat d'autorité approuvé (ex. `docker build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --secret id=npm_ca,src="$NODE_EXTRA_CA_CERTS" -t gopermis-crm .`). Ce certificat n'est monté que pendant npm ci ; vérifications TLS et intégrité npm conservées. Une résolution interne du proxy peut aussi nécessiter `--add-host`, selon l'infrastructure.

Sauvegardes de production à définir : pg_dump chiffré hors serveur, rétention à arbitrer, restauration répétée sur staging. Le test automatisé de restauration ne remplace pas un dispositif de sauvegarde opérationnel. Aucun déploiement public n'est effectué.
