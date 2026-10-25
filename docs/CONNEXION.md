# Connexion et aperçu AI Studio

## Tester l'interface sans hébergement externe

Dans un aperçu de développement Node 24, lancer `npm ci` puis `npm run dev`. Sans `DATABASE_URL` configurée, le projet utilise PGlite local et applique ses migrations. Aucun service PostgreSQL externe n'est nécessaire pour travailler sur le design.

Au premier lancement, si aucun compte n'existe, la page propose « Créer votre accès ». Saisir un nom affiché, l'identifiant souhaité (par exemple `admin`) et un mot de passe personnel de 14 caractères minimum. Le compte technique est créé, puis la connexion s'effectue. Aux lancements suivants, utiliser ce même identifiant et ce même mot de passe. Aucun secret n'est prérempli ou inclus dans le dépôt.

Si un compte existe déjà dans la base sélectionnée, le formulaire de création est désactivé côté serveur. Aucune mise à jour du dépôt, aucun redémarrage et aucune variable de bootstrap ne réinitialisent son mot de passe, ses droits ou son état. Le script `user:create` refuse également de remplacer un compte existant.

Les anciennes versions ajoutaient un compte et un mot de passe dans le code et réécrivaient les accès au démarrage. Ce comportement est supprimé. Tout mot de passe qui a déjà été affiché ou commité doit être remplacé avant un usage réel ; ne pas l'intégrer à nouveau au code, au chat ou aux captures.

## Persistance de l'aperçu

Les données de prévisualisation sont stockées dans `.data/preview`, ou dans `PGLITE_DATA_DIR` si ce chemin est renseigné. Une base en mémoire n'est plus créée à chaque redémarrage. Compte, sessions et dossiers survivent tant que ce répertoire est conservé. Le répertoire `.data` est exclu de Git et des images Docker. Les fragments de base précédemment suivis dans Git sont retirés du suivi **sans suppression des fichiers locaux**.

Un environnement qui supprime entièrement son espace de travail perd aussi cette base locale : Git ne sauvegarde pas les comptes. Utiliser PostgreSQL et des sauvegardes pour les données réelles. PGlite est réservé aux aperçus privés, avec un seul processus et un pool d'une connexion ; ne pas lancer deux serveurs ou le script de création de compte simultanément sur le même répertoire. Pour créer le premier compte d'aperçu, privilégier le formulaire.

Les données fictives ne sont plus injectées automatiquement au démarrage. Les données déjà présentes ne sont pas effacées.

## Configuration

- Avec une vraie `DATABASE_URL`, le mode PostgreSQL est sélectionné. Si cette base est indisponible, l'API renvoie une erreur 503 ; elle ne bascule jamais silencieusement sur une base vide.
- Pour un aperçu local explicitement embarqué : `DATABASE_MODE=pglite`, `DATABASE_URL` vide, répertoire persistant en écriture. Une URL factice ne doit pas être utilisée.
- En mode production, PostgreSQL est requis par défaut et le formulaire initial est désactivé. Un aperçu privé lancé avec `next start` doit explicitement choisir `DATABASE_MODE=pglite` et `ALLOW_PREVIEW_SETUP=1` s'il souhaite le formulaire initial. Ne pas activer cette option sur une application publique.
- Un compte initial peut aussi être créé avec `BOOTSTRAP_IDENTIFIER`, `BOOTSTRAP_NAME` et `BOOTSTRAP_PASSWORD` fournis via la configuration privée. Le bootstrap automatique ne s'applique qu'à une base sans utilisateur ; pour PostgreSQL appliquer les migrations d'abord. Aucun compte existant n'est modifié. `BOOTSTRAP_EMAIL` reste accepté pour compatibilité avec les anciens scripts.
- `APP_ORIGIN` doit correspondre à l'origine exacte du navigateur lorsqu'il est renseigné. Sinon l'origine exacte de la requête Next est utilisée pour l'aperçu. Les écritures sans Origin ou provenant d'un autre site sont refusées ; aucun passe-droit localhost n'est conservé.

## Symptôme « Unexpected token '<' »

Ce message signifie qu'une page HTML était envoyée à `response.json()`. Le client vérifie maintenant le type de réponse avant de lire le JSON : il affiche une erreur compréhensible avec le statut HTTP, sans injecter le contenu HTML ou des informations serveur. Les erreurs JSON illisibles sont distinguées des identifiants incorrects.

Une réponse HTML peut venir du serveur de développement, d'un routage de l'aperçu ou d'un intermédiaire ; le message seul ne prouve pas lequel. Le parcours corrigé a été exécuté sur un vrai serveur Next, avec démarrage à froid du stockage embarqué, et un retour HTML 502 a été reproduit dans le navigateur pour vérifier le message affiché. Une page statique ne peut pas remplacer le serveur Next qui sert `/api/*`.

## Régressions vérifiées

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:preview
PREVIEW_BROWSER=1 CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:preview
npm run test:integration
npm run test:native
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm audit --audit-level=high
```

Le scénario aperçu utilise une base temporaire et des mots de passe aléatoires de test. Il vérifie : création du premier administrateur et refus d'une deuxième création, connexion par identifiant normalisé, compatibilité `username`/`email`, Origin, corps invalides, mauvaise authentification, session et compte conservés après redémarrage, absence de données fictives injectées, déconnexion et indisponibilité PostgreSQL sans repli silencieux. L'option navigateur remplit le formulaire initial, se connecte, reproduit une réponse HTML 502 puis réessaie avec la vraie API.

Les suites PGlite/PostgreSQL et le parcours navigateur métier sont conservés. Aucun nouvel accès moniteur ou rôle métier n'est attribué. Le champ historique `app_user.email` stocke encore l'identifiant pour compatibilité avec la base V3 ; il n'est pas renommé et les comptes ne sont pas migrés destructivement.

## Refonte : aperçu intégré et cookies bloqués

Le point d'entrée de l'aperçu privé est maintenant `npm run preview`. Il force une base locale distincte, même si une ancienne variable DATABASE_URL ou APP_ORIGIN a été recopiée dans l'environnement ; aucune connexion à la base d'équipe n'est faite par cette commande. Le dossier `.data/preview` doit rester conservé. La commande standard `npm run dev` reste disponible pour le développement avec la configuration choisie.

La connexion est gérée par `AuthGate` et un service serveur dédié : état initial unique `/api/auth/status`, création initiale `/api/auth/register`, connexion `/api/auth/login`, session `/api/me`, déconnexion `/api/auth/logout`, changement de mot de passe `/api/auth/password`. Les anciens endpoints sont conservés pour compatibilité. L'écran métier n'est ouvert qu'après confirmation de la session par une requête distincte ; un problème de catalogue ne renvoie plus sur un formulaire de connexion. Les erreurs de session sont identifiées par code, sans comparaison de messages en français.

L'aperçu PGlite n'ouvre **plus aucun serveur TCP**. Un adaptateur direct sérialise les requêtes ; un client conserve l'exclusivité de BEGIN à COMMIT/ROLLBACK. PostgreSQL natif continue d'utiliser pg, ses transactions et ses contraintes. PGlite reste réservé au développement et ne remplace pas les validations de concurrence native.

En aperçu privé seulement, une session d'une heure peut être transportée via Authorization lorsque les cookies de l'iframe sont bloqués. Le jeton aléatoire est uniquement stocké dans sessionStorage de l'onglet (ou en mémoire si le navigateur bloque aussi ce stockage), jamais dans localStorage ni dans une URL. La base n'en conserve que le hash. Il expire et reste révocable ; fermer l'onglet supprime son stockage. Les cookies sont également définis, avec Secure/SameSite=None/Partitioned dans l'aperçu HTTPS. En usage d'équipe/production, seuls les cookies HttpOnly sont utilisés, aucun jeton de session n'est renvoyé dans le JSON et le transport Authorization d'aperçu est refusé.

En mode aperçu, les requêtes réellement same-origin sont reconnues derrière un proxy via les en-têtes Host/Forwarded et Sec-Fetch-Site du navigateur. En mode production, l'origine publique configurée reste stricte ; aucune origine absente ou étrangère n'est autorisée par défaut.

Le lien « Mon compte · mot de passe » permet de changer son mot de passe avec vérification de l'ancien et confirmation du nouveau. Toutes les sessions sont révoquées transactionnellement et un audit est enregistré. La limitation de connexion compte désormais les échecs, pas les connexions réussies.

Si l'accès est perdu, l'opérateur du serveur peut fournir RESET_IDENTIFIER et RESET_PASSWORD via sa configuration privée puis exécuter `npm run user:reset-password`. En PGlite, arrêter d'abord le serveur utilisant ce dossier. Aucun compte n'est créé, réactivé ou doté de nouveaux droits par cette récupération ; les sessions sont révoquées et l'action est marquée dans l'audit comme récupération locale par l'opérateur. Ne jamais placer le secret dans une commande historisée ou dans Git.

Le test navigateur d'aperçu supprime volontairement Cookie sur toutes les requêtes API : création du premier administrateur, connexion et rechargement réussissent avec ce blocage. Il vérifie aussi un retour HTML 502, une nouvelle tentative réussie, le redémarrage, les transactions métier sur l'adaptateur direct, le changement/rétablissement du mot de passe et la révocation des sessions. La suite HTTP de production vérifie l'absence de jeton dans le JSON et le refus du transport Bearer d'aperçu.
