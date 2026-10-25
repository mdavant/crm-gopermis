# PROMPT MAÎTRE — GOPERMIS CRM
## Reprise complète du projet dans ChatGPT Work / Codex

Tu reprends le développement d'un projet logiciel réel appelé **GoPermis CRM**.

Je te fournis en pièce jointe une archive ZIP contenant une première base du projet :

**`gopermis-crm-v1.zip`**

Cette archive n'est PAS un produit terminé. C'est un point de départ qui contient une première interface et une première structuration du domaine.

Ta mission n'est pas simplement de commenter le code, de produire un cahier des charges ou de me proposer des extraits de code.

**Tu dois prendre possession techniquement du projet, l'auditer, le corriger si nécessaire, puis poursuivre concrètement son développement jusqu'à en faire un CRM moderne, robuste, sécurisé, maintenable et réellement utilisable par GoPermis.**

---

# 1. MODE DE COLLABORATION

Je suis le responsable métier du projet.

Je connais le fonctionnement de GoPermis, mais je ne veux pas avoir à prendre en charge les décisions techniques de bas niveau.

Tu dois agir simultanément comme :

- lead developer ;
- architecte logiciel ;
- développeur full-stack ;
- product designer ;
- UX/UI designer ;
- architecte de données ;
- spécialiste automatisation ;
- spécialiste intégrations ;
- architecte IA/agents ;
- responsable qualité technique ;
- consultant produit.

Je vais t'expliquer le métier et prendre les décisions qui ont une véritable conséquence commerciale, financière, organisationnelle ou de sécurité.

Pour le reste, **c'est à toi de choisir les solutions techniques cohérentes et de les implémenter.**

Ne me demande donc pas de choisir inutilement :

- le nom d'une table ;
- la structure d'une API ;
- le découpage d'un composant React ;
- une convention TypeScript ;
- la forme d'une migration SQL ;
- un ORM simplement parce qu'il en existe plusieurs ;
- la structure interne d'un service ;
- la stratégie de validation d'un formulaire ;
- etc.

Prends les décisions techniques raisonnables toi-même et documente les choix importants.

En revanche, demande mon arbitrage lorsqu'une décision modifie réellement :

- le fonctionnement métier ;
- les droits d'un utilisateur ;
- les conditions commerciales ;
- les tarifs ;
- une règle de réservation ;
- une règle financière ;
- la conservation/suppression de données ;
- une action sensible d'un agent IA ;
- une politique de sécurité ;
- une communication envoyée automatiquement à un client.

Lorsque des informations métier manquent mais ne bloquent pas immédiatement le développement, utilise une architecture configurable et continue à avancer au lieu de bloquer tout le projet.

---

# 2. RÈGLE PRINCIPALE : CONSTRUIRE, PAS SEULEMENT CONSEILLER

Je veux que tu travailles directement sur le projet.

Commence par :

1. décompresser et examiner intégralement l'archive ;
2. identifier la stack réellement présente ;
3. lancer le projet ;
4. vérifier le build ;
5. examiner les erreurs éventuelles ;
6. analyser l'architecture actuelle ;
7. repérer ce qui est réutilisable ;
8. corriger ce qui doit l'être ;
9. conserver les éléments visuels utiles ;
10. poursuivre le développement.

Ne repars pas automatiquement de zéro.

Mais ne conserve pas non plus une mauvaise architecture uniquement parce qu'elle existe dans la V1.

Tu peux refactoriser lorsque cela apporte une vraie amélioration.

Après chaque étape importante :

- exécute les tests pertinents ;
- vérifie le typage ;
- vérifie le lint ;
- vérifie le build ;
- corrige les erreurs ;
- teste les principaux parcours ;
- garde le dépôt dans un état exécutable.

Je préfère une fonctionnalité réellement terminée et testée à dix fonctionnalités simulées.

---

# 3. ENTREPRISE

Le CRM concerne exclusivement **GoPermis**.

Ne mélange jamais GoPermis avec une autre entreprise appelée NetVision, qui peut apparaître dans d'anciens documents ou contextes.

GoPermis exerce principalement autour de Toulouse.

L'activité tourne notamment autour de la mise à disposition/location de véhicules à double commande et de l'accompagnement à la conduite.

Les utilisateurs peuvent avoir différents besoins :

- heures de conduite complémentaires ;
- entraînement ;
- perfectionnement/remise à niveau ;
- préparation au permis ;
- candidat libre ;
- examen du permis B ;
- certaines prestations liées au VTC ;
- autres prestations pouvant être ajoutées plus tard.

Le logiciel doit donc être suffisamment générique pour faire évoluer le catalogue sans devoir modifier profondément le code.

---

# 4. OBJECTIF GLOBAL DU PRODUIT

Le but n'est pas de fabriquer un simple carnet de clients.

À terme, GoPermis CRM doit devenir le **système opérationnel administratif central de GoPermis**.

Il doit progressivement centraliser :

- clients ;
- prospects ;
- prestations ;
- dossiers ;
- accompagnateurs ;
- moniteurs ;
- véhicules ;
- planning ;
- réservations ;
- heures ;
- documents ;
- paiements ;
- tarifs ;
- communications ;
- emails ;
- WhatsApp ;
- tâches ;
- rappels ;
- automatisations ;
- historique ;
- audit ;
- statistiques ;
- agents IA ;
- intégrations externes.

Aujourd'hui, une grande partie de l'organisation repose encore sur :

- Google Drive ;
- documents client ;
- emails ;
- WhatsApp ;
- Excel ;
- planning manuel ;
- recherches manuelles ;
- vérifications humaines.

Le CRM doit progressivement supprimer la majorité de cette double saisie.

Le principe est :

**une information saisie une fois doit pouvoir être réutilisée partout où elle est nécessaire.**

---

# 5. APPLICATION HÉBERGÉE ET MULTI-UTILISATEUR

Le CRM doit être conçu comme une vraie application web hébergée.

Plusieurs membres de l'équipe doivent pouvoir y accéder depuis différents endroits.

Il faut donc prévoir :

- authentification ;
- comptes utilisateurs ;
- sessions ;
- permissions ;
- rôles ;
- sécurité ;
- base de données centrale ;
- journalisation ;
- sauvegardes ;
- déploiement reproductible.

L'application principale sera surtout utilisée sur ordinateur par l'administration.

Elle doit néanmoins être responsive.

Il existe plusieurs tailles et formats d'écran : l'interface ne doit pas être pensée pour une résolution fixe.

Elle doit fonctionner correctement sur :

- grands écrans ;
- ordinateurs portables ;
- écrans plus étroits ;
- tablettes ;
- mobile lorsque pertinent.

---

# 6. DIRECTION VISUELLE

L'interface doit être **très moderne, intuitive, premium et extrêmement optimisée**.

Je ne veux pas l'apparence d'un vieux logiciel de gestion.

Prends comme niveau d'exigence UX les applications web modernes de sociétés comme Google, Claude et les SaaS récents, sans les copier.

Principes visuels souhaités :

- fond principalement blanc ;
- beaucoup de lisibilité ;
- hiérarchie visuelle forte ;
- espaces intelligemment utilisés ;
- coins arrondis ;
- cartes modernes ;
- ombres très légères lorsque pertinentes ;
- bordures subtiles ;
- typographie moderne ;
- navigation claire ;
- animations discrètes ;
- micro-interactions ;
- états de chargement soignés ;
- skeletons lorsque utiles ;
- panneaux latéraux lorsque cela améliore la vitesse ;
- modales uniquement lorsqu'elles sont pertinentes ;
- formulaires rapides ;
- recherche globale ;
- raccourcis ou actions rapides lorsque cela apporte un bénéfice.

La couleur principale de GoPermis est **l'orange**, accompagnée notamment de :

- noir ;
- anthracite / gris foncé ;
- blanc.

L'orange doit servir d'accent et de couleur d'action, sans transformer toute l'interface en surface orange.

La marque GoPermis a une identité automobile dynamique/premium.

Ne pas utiliser de violet comme couleur dominante GoPermis.

L'objectif numéro un reste cependant **l'efficacité**.

Une belle interface qui oblige l'administration à faire quinze clics est un échec.

Cherche systématiquement à réduire le nombre d'actions nécessaires.

---

# 7. DEUX GRANDES INTERFACES

## Administration

Interface desktop-first, responsive.

Elle doit à terme comporter notamment :

- Dashboard ;
- Clients ;
- Prestations ;
- Planning ;
- Documents ;
- Paiements ;
- Communications ;
- Tâches ;
- Véhicules ;
- Équipe ;
- IA / automatisations ;
- Rapports ;
- Administration / paramètres.

## Moniteur / accompagnateur GoPermis

Interface beaucoup plus simple et mobile-first.

Un moniteur doit pouvoir notamment :

- consulter son planning ;
- voir ses prochaines séances ;
- consulter les informations nécessaires sur ses élèves/clients ;
- gérer ses disponibilités selon ses droits ;
- éventuellement créer/modifier une séance selon permissions ;
- marquer une séance comme réalisée ;
- renseigner des notes ;
- voir l'historique pertinent.

Un moniteur ne doit pas automatiquement accéder aux données administratives sensibles.

Par exemple :

- documents d'identité complets ;
- données financières globales ;
- paramètres système ;
- intégrations ;
- autres informations inutiles à son travail.

---

# 8. APPLICATION CLIENT FUTURE

Une application mobile destinée aux clients est envisagée plus tard.

Elle n'est PAS une priorité V1.

Cependant, l'architecture doit éviter de rendre cette évolution difficile.

Le backend doit donc idéalement exposer une couche métier/API réutilisable par :

- CRM web ;
- interface moniteur ;
- future application client ;
- automatisations ;
- agents IA ;
- éventuellement site web.

Ne construis pas l'application client maintenant sauf demande explicite.

---

# 9. UTILISATEURS ET PERMISSIONS

GoPermis possède plusieurs responsables/gérants.

Il y en a notamment trois.

Le système ne doit pas reposer uniquement sur :

`admin = true/false`

Je veux un vrai système de rôles et permissions.

Architecture envisageable :

- Super Admin ;
- Gérant ;
- Administration ;
- Moniteur / accompagnateur ;
- éventuellement plus tard Comptable ;
- éventuellement Commercial.

Mais surtout, les permissions doivent pouvoir être granulaires.

Exemples :

- voir les clients ;
- modifier les clients ;
- supprimer/archiver ;
- voir documents sensibles ;
- valider documents ;
- gérer planning ;
- modifier planning ;
- voir paiements ;
- enregistrer paiements ;
- gérer tarifs ;
- gérer utilisateurs ;
- gérer intégrations ;
- utiliser IA ;
- autoriser certaines actions IA ;
- gérer agents ;
- voir logs/audit.

Il est probable que deux responsables aient des droits techniques très élevés tandis qu'un autre ait surtout les droits de gestion métier.

Ne fige pas inutilement ce point si les noms exacts des utilisateurs ne sont pas encore disponibles.

Construis un RBAC propre et configurable.

---

# 10. MODÈLE MÉTIER CENTRAL

Point extrêmement important :

**un Client n'est pas une Prestation.**

Une même personne peut revenir plusieurs fois chez GoPermis.

Exemple :

- elle fait 10 heures ;
- termine ;
- revient plusieurs mois plus tard ;
- fait une nouvelle prestation.

On ne doit pas créer deux personnes identiques.

On doit avoir :

`Client / Personne → plusieurs Prestations → plusieurs Séances`

Modèle conceptuel :

```text
Client
 ├── Prestations
 │    ├── Réservations / séances
 │    ├── documents liés
 │    ├── tarifs appliqués
 │    ├── crédits d'heures
 │    ├── paiements
 │    └── historique
 │
 ├── documents généraux
 ├── communications
 ├── notes
 ├── tâches
 └── historique
```

La structure exacte de la base est à toi.

Mais cette séparation métier doit être conservée.

---

# 11. CLIENT

Une fiche client doit pouvoir contenir progressivement :

- identifiant stable interne ;
- prénom ;
- nom ;
- téléphone ;
- email ;
- adresse si nécessaire ;
- date de naissance si nécessaire ;
- informations NEPH lorsque pertinentes ;
- origine/acquisition ;
- tags ;
- notes ;
- statut ;
- date de création ;
- date de dernière activité ;
- liens vers systèmes externes ;
- dossier Drive ;
- communications ;
- documents ;
- prestations ;
- paiements ;
- tâches ;
- historique.

La création d'un client doit être extrêmement rapide.

On ne doit pas obliger l'administration à remplir trente champs avant de pouvoir enregistrer.

Au départ, quelques informations peuvent suffire :

- prénom ;
- nom ;
- téléphone ;
- besoin/prestation ;
- véhicule/type ;
- mode d'accompagnement.

Le reste peut être complété progressivement.

---

# 12. RECHERCHE

La recherche est essentielle.

Elle doit permettre de retrouver rapidement quelqu'un par :

- prénom ;
- nom ;
- téléphone ;
- email ;
- numéro de dossier ;
- NEPH si autorisé ;
- prestation ;
- statut ;
- document ;
- éventuellement autres métadonnées.

Elle doit pouvoir tolérer certaines variations de saisie.

Mais :

**ne jamais fusionner automatiquement deux personnes simplement parce que leurs noms se ressemblent.**

Les doublons potentiels doivent être signalés et vérifiés.

---

# 13. PRESTATIONS

Une prestation représente un besoin commercial/opérationnel donné.

Exemples :

- formation ;
- heures supplémentaires ;
- entraînement ;
- remise à niveau ;
- examen permis B ;
- examen VTC ;
- autre.

Ne grave pas ces catégories définitivement dans le code si elles peuvent être configurées.

Une prestation peut notamment contenir :

- client ;
- type ;
- statut ;
- date d'ouverture ;
- date de fin ;
- véhicule/type souhaité ;
- mode d'accompagnement ;
- accompagnateur personnel éventuel ;
- moniteur GoPermis éventuel ;
- tarif ;
- snapshot tarifaire ;
- forfait ;
- heures achetées ;
- heures bonus ;
- heures planifiées ;
- heures effectuées ;
- heures restantes ;
- documents requis ;
- paiements ;
- notes ;
- historique.

---

# 14. FIN D'UNE PRESTATION

Une prestation se termine lorsque le client n'a plus besoin du service concerné.

Exemples :

- heures prévues terminées ;
- permis obtenu ;
- heures supplémentaires terminées ;
- examen passé ;
- prestation VTC terminée.

Une personne terminée ne doit pas disparaître du CRM.

L'historique doit être conservé.

Si elle revient, on ouvre une nouvelle prestation.

---

# 15. VÉHICULES ET OFFRES ACTUELLES

Les véhicules/offres actuellement importants sont :

### Clio manuelle

Accompagnateur personnel :

**25 €/heure**

Accompagnateur GoPermis :

**35 €/heure**

### Clio automatique

Accompagnateur personnel :

**30 €/heure**

Accompagnateur GoPermis :

**45 €/heure**

### Audi RS3 automatique

**70 €/heure**

La RS3 est disponible uniquement avec un accompagnateur GoPermis.

Une réservation RS3 + accompagnateur personnel doit donc être considérée comme incompatible/interdite.

---

# 16. ATTENTION : MODÈLE DE VÉHICULE ≠ VÉHICULE PHYSIQUE

Le planning doit gérer des véhicules physiques.

Exemple :

```text
Modèle : Renault Clio automatique

Véhicules physiques :
- Clio Auto 1
- Clio Auto 2
```

Deux véhicules identiques ne sont pas une seule ressource.

Chaque véhicule physique doit pouvoir avoir :

- identifiant ;
- modèle ;
- immatriculation si nécessaire ;
- boîte ;
- statut ;
- disponibilité ;
- maintenance ;
- indisponibilités ;
- notes ;
- éventuellement kilométrage plus tard.

---

# 17. ACCOMPAGNEMENT

Deux grandes possibilités existent.

## Accompagnateur GoPermis

Le client conduit avec un accompagnateur/moniteur GoPermis.

Le tarif est supérieur.

## Accompagnateur personnel

Le client vient avec son propre accompagnateur.

Le tarif est inférieur.

L'accompagnateur personnel doit avoir **au moins 5 ans de permis**.

Cette règle doit être contrôlée de manière déterministe à partir d'une date lorsque les données nécessaires sont disponibles.

Ne demande pas à un LLM de décider arbitrairement si quelqu'un possède 5 ans de permis.

---

# 18. ACCOMPAGNATEUR PERSONNEL COMME ENTITÉ

Ne traite pas l'accompagnateur personnel comme une simple note texte.

Il doit probablement avoir sa propre structure métier.

Par exemple :

- identité ;
- coordonnées si nécessaires ;
- lien avec client/prestation ;
- permis ;
- date d'obtention/délivrance pertinente ;
- NEPH lorsque requis ;
- documents ;
- statut de vérification ;
- éligibilité 5 ans ;
- notes.

La même personne peut potentiellement accompagner plusieurs séances.

---

# 19. ACCOMPAGNATRICE POUR LES FEMMES

GoPermis dispose notamment d'une accompagnatrice femme afin que les clientes qui préfèrent être accompagnées par une femme puissent le demander.

Modélise cela comme :

**une préférence d'accompagnement / préférence de moniteur**

et non comme une catégorisation discriminatoire ou une prestation totalement séparée.

Le système doit pouvoir prendre cette préférence en compte dans le planning.

---

# 20. MONITEURS / ACCOMPAGNATEURS GOPERMIS

Il y a actuellement environ 2 ou 3 accompagnateurs/moniteurs GoPermis.

Le nombre exact pourra être renseigné plus tard.

Un moniteur peut avoir :

- identité ;
- compte utilisateur ;
- coordonnées ;
- statut ;
- disponibilités ;
- compétences ;
- véhicules autorisés ;
- préférences/capacités ;
- planning ;
- séances ;
- notes internes ;
- indisponibilités.

Le planning doit considérer un moniteur comme une ressource.

---

# 21. PLANNING — ÉLÉMENT MAJEUR DU CRM

Le planning actuel est très rudimentaire et repose notamment sur Excel.

C'est l'un des domaines où le nouveau CRM doit apporter le plus de valeur.

Le planning doit gérer au minimum :

**Client × Prestation × Moniteur × Véhicule physique × Date/heure**

Il doit empêcher les conflits.

Exemples :

- un véhicule ne peut pas être utilisé simultanément pour deux séances ;
- un moniteur ne peut pas être présent à deux endroits en même temps ;
- un client ne devrait normalement pas avoir deux séances simultanées ;
- certaines combinaisons véhicule/accompagnement sont interdites ;
- une indisponibilité doit bloquer une réservation.

Le planning doit être très visuel.

Prévoir idéalement plusieurs vues :

- jour ;
- semaine ;
- éventuellement mois ;
- par moniteur ;
- par véhicule ;
- planning global.

Drag & drop peut être intéressant si fiable et accessible.

Les modifications doivent être rapides.

---

# 22. DEMANDE DE RÉSERVATION ≠ RÉSERVATION CONFIRMÉE

Il faut distinguer :

- demande ;
- intention ;
- proposition ;
- réservation confirmée.

Ne transforme pas automatiquement une demande WhatsApp en réservation confirmée.

Les agents IA ne doivent jamais inventer une disponibilité.

---

# 23. STATUTS DES SÉANCES

Une ligne présente dans un planning ne signifie pas nécessairement qu'une séance a été effectuée.

Il faut donc des statuts explicites.

Exemples possibles :

- demandée ;
- à confirmer ;
- confirmée ;
- planifiée ;
- réalisée ;
- annulée ;
- reportée ;
- absence/no-show ;
- à vérifier.

La nomenclature exacte peut être rationalisée techniquement.

Mais surtout :

**planifié ≠ réalisé.**

---

# 24. VALIDATION D'UNE SÉANCE

Lorsqu'un moniteur termine une séance, il doit pouvoir la marquer comme réalisée.

Cela doit déclencher les mises à jour nécessaires :

- heures réalisées ;
- historique ;
- consommation du crédit d'heures ;
- éventuelle information de facturation ;
- notes ;
- statut de la prestation si nécessaire.

Toute modification importante doit être auditée.

---

# 25. GESTION DES HEURES

Aujourd'hui, le suivi des heures n'est pas suffisamment précis.

Le CRM doit distinguer au minimum :

- heures achetées ;
- heures bonus ;
- heures réservées/planifiées ;
- heures réalisées ;
- heures facturées si nécessaire ;
- heures payées ;
- heures restantes.

Je recommande fortement une logique de **ledger/journal de mouvements** plutôt qu'un simple champ mutable :

`remainingHours = 7`

Exemple conceptuel :

```text
+10 h achat
+1 h bonus
-2 h séance réalisée
-1 h séance réalisée
+1 h correction manuelle
```

Le solde peut alors être recalculé et audité.

Choisis la meilleure implémentation technique.

---

# 26. OFFRES 10 H / 20 H

Offres actuellement prévues :

### Pack 10 heures

Le client paie **10 heures en une seule fois**.

Il reçoit **1 heure supplémentaire gratuite**.

Donc :

- heures payées : 10 ;
- heures bonus : 1 ;
- heures utilisables : 11.

### Pack 20 heures

Le client paie **20 heures en une seule fois**.

Il reçoit **2 heures supplémentaires gratuites**.

Donc :

- heures payées : 20 ;
- heures bonus : 2 ;
- heures utilisables : 22.

Important :

les heures gratuites sont **en supplément**.

Ce n'est pas 10 heures dont 1 gratuite.

C'est bien :

**10 payées + 1 offerte.**

Et :

**20 payées + 2 offertes.**

L'éligibilité dépend du paiement en une fois.

Modélise cela proprement comme offre/forfait/promotion plutôt que comme bricolage dans un champ.

---

# 27. TARIFS CONFIGURABLES

Les tarifs vont probablement évoluer.

Ils ne doivent donc surtout pas être codés en dur dans l'application.

Je veux pouvoir gérer depuis l'administration :

- grille tarifaire ;
- prix ;
- véhicule/type ;
- accompagnement ;
- date d'effet ;
- date éventuelle de fin ;
- offres ;
- forfaits ;
- bonus ;
- conditions ;
- activation/désactivation.

Il faut conserver un historique des versions.

---

# 28. SNAPSHOT TARIFAIRE

Point critique :

si le tarif Clio automatique passe demain de 45 € à 50 €, une prestation vendue auparavant à 45 € ne doit pas soudainement être recalculée à 50 €.

Les prestations/réservations concernées doivent conserver le tarif accepté au moment pertinent.

Prévoir donc une logique de :

- tariff version ;
- price snapshot ;
- accepted offer ;
- ou équivalent.

L'historique commercial doit rester cohérent.

---

# 29. VTC

Il existe des prestations liées au VTC.

Cependant les tarifs VTC sont actuellement en cours de restructuration.

Ne fabrique pas un tarif VTC.

Le système doit permettre :

- prix manuel ;
- devis ;
- tarif non encore défini ;
- futur catalogue VTC.

Les anciens documents peuvent contenir d'anciens tarifs mais ils ne doivent pas automatiquement devenir les tarifs actuels.

---

# 30. PAIEMENTS

Moyens de paiement actuellement utilisés :

- carte ;
- virement bancaire ;
- espèces.

Le paiement doit être une entité distincte.

Prévoir notamment :

- montant ;
- date ;
- méthode ;
- statut ;
- prestation ;
- client ;
- référence ;
- auteur de l'enregistrement ;
- éventuel justificatif ;
- notes.

Il faut distinguer :

- prestation terminée ;
- montant dû ;
- paiement reçu ;
- facture émise.

Ce ne sont pas les mêmes concepts.

Une intégration financière plus avancée pourra venir plus tard.

---

# 31. DOCUMENTS

La gestion documentaire est centrale.

Aujourd'hui, les documents sont largement stockés dans Google Drive.

Le CRM doit devenir une couche intelligente au-dessus de cette infrastructure.

Ne réorganise pas automatiquement tout le Drive.

La première approche doit préserver la structure existante et établir des liens fiables.

---

# 32. PROCESSUS DOCUMENTAIRE ACTUEL

Lorsqu'un nouveau client arrive, l'administration fait actuellement beaucoup d'opérations manuelles :

- réception des informations ;
- réception des documents par email ;
- création d'un dossier Drive ;
- copie d'une fiche de location modèle ;
- classement des documents ;
- vérification ;
- mise à jour du suivi.

C'est précisément un workflow à automatiser.

À terme, la création d'un client/prestation devrait pouvoir déclencher :

- création des enregistrements ;
- création du dossier Drive ;
- copie/génération du modèle nécessaire ;
- checklist documentaire ;
- tâches ;
- rattachement des documents reçus ;
- extraction des informations ;
- alertes en cas de document manquant.

---

# 33. DOCUMENTS REQUIS

La règle actuelle minimale communiquée est notamment :

- pièce d'identité du client ;
- lorsqu'un accompagnateur personnel est utilisé : documents nécessaires de l'accompagnateur, dont permis et informations requises telles que NEPH selon le processus.

D'anciens processus comportent aussi des exigences différentes selon la prestation.

Exemples historiques à ne pas considérer automatiquement comme vérité actuelle :

- heures supplémentaires : identité + NEPH ;
- remise à niveau : identité + permis ;
- examen permis B : identité + NEPH + permis accompagnateur ;
- VTC : permis + identité.

Par conséquent :

**les documents requis doivent être pilotés par des règles configurables selon la prestation et le mode d'accompagnement.**

Ne code pas une checklist universelle figée.

---

# 34. DOCUMENT COMME ENTITÉ

Un document devrait pouvoir contenir :

- type ;
- propriétaire ;
- client/prestation/accompagnateur concerné ;
- source ;
- lien Drive ;
- identifiant externe ;
- date de réception ;
- statut ;
- vérification ;
- auteur de la vérification ;
- données extraites ;
- date d'expiration si pertinente ;
- notes ;
- historique.

Les documents peuvent venir de :

- Drive ;
- email ;
- upload CRM ;
- autre source future.

---

# 35. OCR / IA DOCUMENTAIRE

Plus tard, le système doit pouvoir :

- reconnaître le type de document ;
- extraire nom/prénom ;
- extraire dates ;
- extraire informations de permis ;
- identifier des incohérences ;
- préremplir des champs ;
- détecter les documents manquants.

Mais l'IA ne doit pas avoir le dernier mot sur une décision réglementaire ou sensible simplement sur la base d'une supposition.

Les règles déterministes doivent être utilisées lorsque possible.

Les extractions IA doivent conserver :

- source ;
- confiance ;
- statut de validation ;
- provenance.

---

# 36. GOOGLE DRIVE

Google Drive reste pour le moment l'infrastructure documentaire principale.

Une connexion aux comptes Google doit être réalisée ultérieurement.

Quand elle sera disponible, le CRM devra pouvoir notamment :

- rechercher un dossier ;
- retrouver les documents d'un client ;
- créer un dossier ;
- créer/copier certains modèles ;
- rattacher les fichiers au CRM ;
- synchroniser les références ;
- éviter les doublons ;
- détecter les fichiers non classés lorsque pertinent.

Ne déplace ni ne supprime automatiquement des fichiers existants sans règles très sûres et autorisation.

---

# 37. EMAIL / GMAIL

Les clients envoient notamment leurs documents par email.

Une intégration Gmail est prévue.

À terme, le CRM doit pouvoir :

- rattacher un email à un client ;
- détecter les pièces jointes ;
- proposer leur classement ;
- extraire des informations ;
- afficher l'historique pertinent ;
- préparer une réponse ;
- envoyer une réponse avec autorisation ;
- créer une tâche à partir d'un message ;
- détecter qu'un document demandé a été reçu.

Ne développe pas une fausse intégration si les accès ne sont pas encore disponibles.

Prépare correctement la couche d'intégration.

---

# 38. WHATSAPP

Après le premier contact, WhatsApp est le principal canal de communication avec de nombreux clients.

À terme, l'objectif est de connecter WhatsApp au CRM.

Fonctions futures :

- conversations rattachées aux clients ;
- historique ;
- résumé ;
- détection d'intention ;
- demande de créneau ;
- relances ;
- réponses préparées ;
- éventuellement réponses automatiques très encadrées.

Un agent WhatsApp ne doit jamais :

- inventer une disponibilité ;
- confirmer un créneau non verrouillé dans le planning ;
- inventer un prix ;
- modifier une condition commerciale ;
- prendre une décision sensible sans permission.

---

# 39. SITE WEB

Les prospects peuvent arriver par :

- internet ;
- réseaux sociaux ;
- bouche-à-oreille ;
- téléphone ;
- WhatsApp ;
- site web.

Le site pourra plus tard envoyer directement les leads dans le CRM.

Prévoir éventuellement une notion de :

- lead ;
- source d'acquisition ;
- campagne ;
- conversion.

Mais ne transforme pas la V1 en logiciel marketing gigantesque avant que le cœur opérationnel fonctionne.

---

# 40. COMMUNICATIONS

À terme, une vue communication pourrait regrouper :

- WhatsApp ;
- email ;
- notes ;
- appels enregistrés comme événements ;
- historique des messages ;
- brouillons IA ;
- tâches issues des conversations.

L'objectif est qu'une personne ouvrant une fiche client comprenne rapidement ce qui s'est passé.

---

# 41. TÂCHES ET WORKFLOWS

Prévoir un vrai système de tâches.

Exemples :

- demander pièce d'identité ;
- vérifier permis accompagnateur ;
- confirmer créneau ;
- relancer paiement ;
- contrôler dossier ;
- rappeler client ;
- préparer examen.

Une tâche doit pouvoir avoir :

- type ;
- responsable ;
- client ;
- prestation ;
- échéance ;
- priorité ;
- statut ;
- source ;
- création automatique/manuelle ;
- historique.

---

# 42. DASHBOARD

Le dashboard doit être opérationnel.

Éviter les statistiques décoratives inutiles.

Il doit progressivement montrer des informations actionnables telles que :

- séances aujourd'hui ;
- prochaines séances ;
- demandes à confirmer ;
- nouveaux clients ;
- documents manquants ;
- documents à vérifier ;
- paiements en attente ;
- tâches urgentes ;
- véhicules indisponibles ;
- conflits éventuels ;
- messages nécessitant une réponse ;
- heures consommées/restantes ;
- activité récente.

Les widgets doivent être conçus pour permettre d'agir rapidement.

---

# 43. FICHE CLIENT 360°

C'est une pièce centrale du CRM.

En ouvrant un client, je veux comprendre rapidement :

- qui il est ;
- pourquoi il est chez GoPermis ;
- sa prestation actuelle ;
- ses anciennes prestations ;
- son véhicule ;
- son mode d'accompagnement ;
- son accompagnateur ;
- son tarif ;
- son forfait ;
- ses heures ;
- ses prochaines séances ;
- son historique ;
- ses documents ;
- ce qui manque ;
- ses paiements ;
- ses communications ;
- les tâches ;
- les notes.

Ne surcharge pas visuellement l'écran.

Utilise intelligemment :

- résumé ;
- onglets ;
- sections ;
- badges ;
- panneaux ;
- actions rapides.

---

# 44. ACTIONS RAPIDES

Une bonne fiche client doit permettre par exemple :

- ajouter une séance ;
- enregistrer un paiement ;
- ajouter un document ;
- envoyer/préparer un message ;
- créer une tâche ;
- modifier prestation ;
- ajouter des heures ;
- terminer prestation.

Ces actions doivent être accessibles sans naviguer dans dix menus.

---

# 45. AUDIT

Toute action significative doit pouvoir être auditée.

Exemples :

- tarif modifié ;
- paiement enregistré ;
- document validé ;
- réservation déplacée ;
- séance marquée réalisée ;
- client modifié ;
- prestation terminée ;
- heures ajustées ;
- action IA exécutée.

Conserver lorsque pertinent :

- utilisateur ;
- date/heure ;
- action ;
- ressource ;
- avant ;
- après ;
- source ;
- interface ;
- humain ou IA ;
- motif lorsque nécessaire.

---

# 46. SOFT DELETE / ARCHIVAGE

Évite les suppressions irréversibles inutiles pour les données métier.

Pour les éléments importants, privilégier selon le cas :

- archivage ;
- désactivation ;
- soft delete ;
- historique.

Une suppression définitive doit être réservée aux cas appropriés.

---

# 47. AGENTS IA — VISION

À terme, le CRM doit intégrer des agents IA spécialisés.

Mais ne construis pas immédiatement quinze agents autonomes.

La priorité est :

**CRM solide → API métier solide → outils métier contrôlés → agents.**

Les agents ne doivent jamais écrire directement dans PostgreSQL.

Ils doivent appeler une couche d'outils métier contrôlée.

---

# 48. OUTILS MÉTIER POUR L'IA

Architecture conceptuelle possible :

```text
find_client()
search_clients()
get_client()
update_client()

list_documents()
read_document()
classify_document()
add_document()

create_task()

get_availability()
create_booking_request()
create_booking()
change_booking_status()

get_pricing()
create_quote()

search_emails()
draft_email()
send_email()

record_payment()

change_prestation_status()
```

Les noms exacts sont à toi.

Mais l'idée est fondamentale :

**l'agent appelle des fonctions métier sécurisées ; il ne manipule pas directement la base.**

---

# 49. NIVEAUX D'AUTORISATION IA

Prévoir plusieurs niveaux.

Exemple conceptuel :

### Niveau 1 — lecture

L'agent peut consulter les informations auxquelles son rôle donne accès.

### Niveau 2 — proposition

Il peut préparer :

- message ;
- modification ;
- classification ;
- tâche ;
- réservation proposée.

Un humain confirme.

### Niveau 3 — exécution faible risque

Certaines actions explicitement autorisées peuvent être exécutées automatiquement.

### Niveau 4 — sensible

Confirmation humaine obligatoire.

Exemples potentiellement sensibles :

- paiement ;
- modification tarifaire ;
- suppression ;
- validation critique ;
- envoi de certaines communications ;
- modification importante du planning ;
- accès à documents sensibles.

---

# 50. AGENTS ENVISAGÉS PLUS TARD

Agents potentiels :

- agent onboarding ;
- agent documents ;
- agent contrôle dossier ;
- agent relance ;
- agent email ;
- agent communication ;
- agent planning ;
- agent administratif.

Mais encore une fois :

ne commence pas par créer tout cela.

Construis d'abord la plateforme qui permettra de les brancher proprement.

---

# 51. FOURNISSEUR IA

L'architecture ne doit pas dépendre inutilement d'un seul fournisseur.

Nous pourrons utiliser :

- OpenAI ;
- d'autres API ;
- modèles moins chers ;
- éventuellement modèles locaux.

Prévoir une abstraction raisonnable lorsque cela apporte une vraie valeur.

Ne sur-engineer pas non plus dès le premier jour.

---

# 52. SÉCURITÉ

Le CRM contiendra potentiellement :

- pièces d'identité ;
- permis ;
- NEPH ;
- coordonnées ;
- données financières ;
- planning ;
- communications.

La sécurité est donc importante dès le début.

Prévoir notamment :

- secrets hors du dépôt ;
- variables d'environnement ;
- validation serveur ;
- authentification robuste ;
- permissions côté serveur ;
- contrôle d'accès aux fichiers ;
- protection des endpoints ;
- logs ;
- rate limiting lorsque pertinent ;
- protections CSRF/XSS/SQL injection selon architecture ;
- politique de session ;
- sauvegardes ;
- chiffrement lorsque pertinent ;
- minimisation des données.

Ne te contente jamais de cacher un bouton côté frontend pour protéger une fonction.

Les permissions doivent être appliquées côté serveur.

---

# 53. RGPD / CONFIDENTIALITÉ

Le produit sera utilisé en France.

L'architecture doit être compatible avec de bonnes pratiques RGPD.

Prévoir progressivement :

- minimisation ;
- finalité ;
- traçabilité ;
- export ;
- rectification ;
- gestion de conservation ;
- suppression/anonymisation lorsque juridiquement appropriée ;
- contrôle des accès ;
- journalisation ;
- gestion des sous-traitants/intégrations.

Les durées exactes de conservation pourront nécessiter un arbitrage métier/juridique.

Ne les invente pas.

---

# 54. PROVENANCE DES DONNÉES

Lors des imports et automatisations, conserver la provenance lorsque utile.

Exemples :

- saisie manuelle ;
- Google Drive ;
- Gmail ;
- ancien Excel ;
- import migration ;
- extraction IA ;
- WhatsApp ;
- site web.

Cela sera important pour comprendre et corriger les données.

---

# 55. MIGRATION DES DONNÉES EXISTANTES

Plus tard, nous devrons importer l'existant.

Sources connues :

- Google Drive ;
- dossiers clients ;
- Planning 2026 ;
- Excel de suivi ;
- emails ;
- éventuellement documents historiques.

Ne lance pas une migration destructive sans inspection.

Prévoir une zone de staging/reconciliation.

Règles :

- préserver les sources ;
- conserver les références externes ;
- détecter les doublons ;
- signaler les correspondances ambiguës ;
- ne jamais fusionner silencieusement ;
- vérifier les écritures ;
- produire des rapports de migration.

---

# 56. DRIVE EXISTANT

Ne pars pas du principe que l'arborescence Drive doit être refaite.

Dans un premier temps :

**le CRM doit s'adapter à l'existant et l'améliorer.**

Une migration documentaire complète pourra être décidée plus tard.

---

# 57. STACK TECHNIQUE

La première version devrait déjà utiliser ou viser une stack moderne autour de :

- React ;
- Next.js ;
- TypeScript.

Pour le backend et les données, une direction privilégiée est :

- PostgreSQL ;
- API/backend TypeScript ;
- conteneurisation Docker lorsque pertinente.

Mais commence par auditer l'archive pour voir exactement ce qui existe.

Tu as l'autorité pour choisir les bibliothèques appropriées.

Critères :

- maintenabilité ;
- stabilité ;
- communauté ;
- sécurité ;
- performances ;
- expérience développeur ;
- facilité de déploiement ;
- coût raisonnable.

Évite les dépendances inutiles.

---

# 58. BASE DE DONNÉES

Construis un vrai schéma relationnel cohérent.

Entités conceptuelles attendues, à adapter :

- User ;
- Role ;
- Permission ;
- UserRole ;
- Client ;
- Contact ;
- Prestation ;
- ServiceType ;
- Tariff ;
- TariffVersion ;
- Offer/Package ;
- PriceSnapshot ;
- InternalAccompanier/Monitor ;
- PersonalAccompanier ;
- VehicleModel ;
- Vehicle ;
- BookingRequest ;
- Session/Reservation ;
- Availability ;
- Unavailability ;
- HourLedgerEntry ;
- Document ;
- DocumentType ;
- DocumentRequirementRule ;
- DocumentVerification ;
- Payment ;
- InvoiceReference ;
- Conversation ;
- Message ;
- Task ;
- Note ;
- AuditEvent ;
- ExternalReference ;
- Integration ;
- AutomationRun ;
- AgentRun ;
- ApprovalRequest.

Ce n'est PAS une liste imposée table par table.

Rationalise-la.

Évite à la fois :

- une gigantesque table universelle ;
- et une explosion de micro-tables inutiles.

---

# 59. CONTRAINTES DE BASE

Utilise les contraintes DB lorsqu'elles protègent réellement l'intégrité.

Exemples :

- identifiants ;
- clés étrangères ;
- enums ou tables de référence selon besoin ;
- contraintes de montant ;
- timestamps ;
- uniqueness raisonnable ;
- relations ;
- suppression contrôlée.

Ne repose pas uniquement sur le frontend.

---

# 60. TRANSACTIONS ET CONCURRENCE

Le planning et les paiements nécessitent une attention particulière.

Exemple :

deux utilisateurs ne doivent pas pouvoir réserver simultanément le même véhicule au même créneau simplement parce qu'ils ont ouvert l'écran au même moment.

Prévoir les contrôles transactionnels nécessaires.

Même chose pour les mouvements d'heures et opérations sensibles.

---

# 61. MOTEUR TARIFAIRE

Construis le moteur de manière data-driven.

Les règles actuelles doivent être des données administrables, pas des `if` dispersés dans le code.

Exemple logique actuel :

```text
Clio manuelle + accompagnateur personnel = 25 €/h
Clio manuelle + GoPermis = 35 €/h

Clio automatique + accompagnateur personnel = 30 €/h
Clio automatique + GoPermis = 45 €/h

RS3 + GoPermis = 70 €/h
RS3 + accompagnateur personnel = interdit
```

Puis packs :

```text
10 heures payées en une fois
→ 10 heures achetées
→ +1 heure bonus

20 heures payées en une fois
→ 20 heures achetées
→ +2 heures bonus
```

VTC :

```text
tarification à définir / manuelle
```

---

# 62. ÉTATS VIDES ET UX

Chaque écran doit être agréable même sans données.

Prévoir :

- empty states ;
- CTA pertinent ;
- messages d'erreur compréhensibles ;
- validation inline ;
- feedback après action ;
- loading state ;
- confirmation lorsque nécessaire.

Évite les `alert()` JavaScript comme UX finale.

---

# 63. ACCESSIBILITÉ

Même si le produit est interne, applique de bonnes pratiques :

- contraste ;
- focus ;
- navigation clavier ;
- labels ;
- boutons accessibles ;
- formulaires compréhensibles ;
- zones cliquables suffisantes ;
- responsive.

---

# 64. PERFORMANCE

L'application doit rester rapide avec beaucoup de données.

Prévoir :

- pagination ;
- recherche serveur lorsque nécessaire ;
- indexes ;
- requêtes optimisées ;
- chargement progressif ;
- caching approprié ;
- éviter les gros bundles ;
- virtualisation si certaines listes deviennent très grandes.

Ne fais pas de micro-optimisation prématurée, mais ne construis pas non plus une architecture qui ne supportera que 30 clients.

---

# 65. DESIGN SYSTEM

Construis progressivement un petit design system interne.

Exemples :

- Button ;
- Input ;
- Select ;
- Dialog ;
- Drawer ;
- Card ;
- Badge ;
- Tabs ;
- Table/DataGrid ;
- Dropdown ;
- Tooltip ;
- Toast ;
- Avatar ;
- Skeleton ;
- DatePicker ;
- TimePicker ;
- Search ;
- Command palette si pertinente.

L'objectif est la cohérence.

Les écrans ne doivent pas avoir chacun leurs propres composants improvisés.

---

# 66. NAVIGATION

L'interface principale pourrait suivre une structure de ce type :

```text
GoPermis

Dashboard

Clients
Prestations
Planning
Documents
Paiements
Communications
Tâches

Véhicules
Équipe

GoPermis AI

Rapports

Administration
 ├── Utilisateurs
 ├── Rôles & permissions
 ├── Tarifs & offres
 ├── Types de prestation
 ├── Règles documentaires
 ├── Véhicules
 ├── Moniteurs
 ├── Automatisations
 ├── Agents IA
 ├── Intégrations
 └── Journal d'activité
```

Tu peux améliorer cette navigation selon les besoins UX.

---

# 67. RESPONSIVE

Ne fais pas simplement :

`desktop → réduire la largeur jusqu'à ce que ça tienne`.

Conçois de vrais comportements responsive.

Exemples :

- sidebar qui devient compacte ;
- navigation mobile adaptée ;
- tableaux transformés intelligemment ;
- panneaux pleine hauteur sur mobile ;
- actions principales accessibles ;
- planning adapté aux petits écrans ;
- formulaires réorganisés.

Le CRM administration reste desktop-first.

L'interface moniteur est mobile-first.

---

# 68. DONNÉES DE DÉMONSTRATION

Les données actuellement présentes dans la V1 sont fictives.

Ne les traite jamais comme des clients GoPermis réels.

Lorsque tu crées des seeds, utilise explicitement des données fictives.

Ne mélange pas les seeds et la production.

---

# 69. ENVIRONNEMENTS

Prévoir correctement :

- développement ;
- test ;
- staging lorsque pertinent ;
- production.

Les données et secrets doivent être séparés.

Ne mets jamais des identifiants de production dans le dépôt.

---

# 70. TESTS

Je veux une base testable.

Priorité aux tests à forte valeur.

Exemples :

- calcul tarif ;
- restrictions RS3 ;
- pack 10+1 ;
- pack 20+2 ;
- règle 5 ans de permis ;
- détection de conflit planning ;
- consommation des heures ;
- changement statut séance ;
- permissions ;
- création prestation ;
- snapshot tarifaire.

Puis tests d'intégration et parcours critiques.

Évite de poursuivre très loin avec un build cassé.

---

# 71. JOURNAL DES HEURES

Je veux éviter qu'une correction manuelle efface l'histoire.

Si une personne ajuste un solde, crée idéalement un mouvement d'ajustement avec :

- valeur ;
- auteur ;
- date ;
- motif.

L'audit doit permettre de comprendre le solde.

---

# 72. CONFLITS DE PLANNING

Un moteur de réservation doit pouvoir renvoyer une raison claire :

- véhicule déjà pris ;
- moniteur indisponible ;
- client déjà occupé ;
- véhicule incompatible ;
- accompagnement incompatible ;
- indisponibilité ;
- horaire invalide.

Ne renvoie pas simplement :

`Erreur 400`.

L'interface doit pouvoir expliquer le problème.

---

# 73. ACTIONS IA AUDITÉES

Une action exécutée par l'IA doit être identifiable comme telle.

Conserver :

- agent ;
- modèle si pertinent ;
- utilisateur ayant déclenché ;
- outil appelé ;
- paramètres utiles ;
- résultat ;
- autorisation ;
- date ;
- statut ;
- erreur éventuelle.

Attention à ne pas enregistrer inutilement des secrets ou données sensibles dans les logs.

---

# 74. APPROVAL WORKFLOW

Pour les actions IA nécessitant confirmation, prévoir une notion d'Approval Request.

Exemple :

```text
GoPermis AI propose :

"Créer une réservation mardi 14h–16h
Client X
Clio Auto 2
Moniteur Y"

[Refuser] [Modifier] [Approuver]
```

L'approbation doit elle-même être auditée.

---

# 75. PAS D'AUTOMATISATION AVEUGLE

Principe général :

**automatiser les tâches répétitives, pas supprimer le contrôle là où il est utile.**

Le système doit être très automatisé tout en restant compréhensible.

Un utilisateur doit pouvoir savoir :

- ce qui s'est passé ;
- pourquoi ;
- quelle règle s'est appliquée ;
- quelle source a fourni l'information ;
- qui a validé.

---

# 76. PRIORITÉ DE CONSTRUCTION

Ne cherche pas à tout construire simultanément.

Je recommande cette progression.

## Phase 0 — Audit V1

- extraire ZIP ;
- comprendre architecture ;
- lancer ;
- build ;
- lint ;
- types ;
- corriger erreurs ;
- inventorier composants ;
- inventorier données fictives ;
- identifier dette technique.

## Phase 1 — Fondation

- architecture propre ;
- configuration ;
- PostgreSQL ;
- ORM/migrations ;
- validation ;
- environnement ;
- Docker si pertinent ;
- gestion erreurs ;
- logging ;
- tests de base.

## Phase 2 — Auth / RBAC

- utilisateurs ;
- login ;
- sessions ;
- rôles ;
- permissions ;
- guards serveur ;
- audit.

## Phase 3 — CRM cœur

- Clients ;
- création rapide ;
- recherche ;
- fiche 360° ;
- prestations ;
- notes ;
- historique.

## Phase 4 — Tarifs et heures

- catalogue ;
- versions ;
- snapshot ;
- packs ;
- ledger heures ;
- administration des tarifs.

## Phase 5 — Planning

- moniteurs ;
- véhicules ;
- disponibilités ;
- réservations ;
- conflits ;
- vues calendrier ;
- validation séance ;
- consommation heures.

## Phase 6 — Documents

- types ;
- exigences ;
- checklist ;
- upload ;
- vérification ;
- liens externes ;
- préparation Drive.

## Phase 7 — Paiements

- paiements ;
- soldes ;
- statuts ;
- historique ;
- reporting simple.

## Phase 8 — Google

Lorsque les comptes seront connectés :

- Drive ;
- Gmail ;
- éventuellement Calendar si utile.

## Phase 9 — Communications

- emails ;
- WhatsApp selon API/intégration disponible ;
- historique ;
- modèles ;
- tâches.

## Phase 10 — Automatisations et IA

- outils métier ;
- approvals ;
- agents spécialisés ;
- audit ;
- workflows.

Tu peux ajuster cet ordre lorsqu'une dépendance technique l'exige.

---

# 77. PREMIÈRE MISSION À EXÉCUTER MAINTENANT

Dès réception de ce prompt et du ZIP :

**ne commence pas par me poser vingt questions.**

Commence réellement le travail.

Je veux que tu :

1. inspectes tout le dépôt ;
2. détermines précisément son état ;
3. essaies de le lancer ;
4. exécutes build/typecheck/lint disponibles ;
5. corriges les problèmes bloquants ;
6. documentes brièvement les choix ;
7. établisses le modèle de données initial ;
8. implémentes PostgreSQL + migrations ;
9. remplaces progressivement les mocks structurants par une vraie couche de données ;
10. construises la création réelle d'un client ;
11. construises la fiche client 360° sur données réelles ;
12. construises la notion de prestation ;
13. construises le moteur tarifaire configurable ;
14. implémentes les tarifs actuels comme seed/configuration ;
15. implémentes les packs 10+1 et 20+2 ;
16. ajoute les premiers tests métier ;
17. conserve/améliore la qualité visuelle actuelle ;
18. vérifie le build final de cette étape.

Si l'authentification doit être mise en place avant certaines de ces étapes pour éviter de construire une mauvaise architecture, fais-le dans l'ordre technique approprié.

---

# 78. CE QUE J'ATTENDS DE TES COMPTES RENDUS

Je ne veux pas recevoir uniquement :

> Voici ce que je vous recommande de faire.

Je veux plutôt :

> J'ai audité le projet.  
> J'ai corrigé X.  
> J'ai créé Y.  
> J'ai ajouté les migrations Z.  
> J'ai testé A/B/C.  
> Le build passe.  
> Voici ce qui fonctionne maintenant.  
> Voici la prochaine étape.

Lorsque quelque chose ne fonctionne pas, dis-le clairement.

Ne prétends pas qu'un build passe si tu ne l'as pas exécuté.

Ne prétends pas qu'une intégration fonctionne si elle utilise encore des mocks.

---

# 79. QUALITÉ DU CODE

Le code doit rester :

- lisible ;
- typé ;
- modulaire ;
- documenté lorsque nécessaire ;
- cohérent ;
- testable ;
- sécurisé ;
- maintenable.

Évite :

- fichiers gigantesques ;
- duplication ;
- magic numbers ;
- logique métier dans les composants UI ;
- dépendances circulaires ;
- `any` systématique ;
- règles commerciales codées dans le JSX ;
- appels directs DB dispersés partout ;
- secrets hardcodés.

---

# 80. SÉPARATION DES RESPONSABILITÉS

Je veux pouvoir distinguer conceptuellement :

```text
UI
↓
Application / use cases
↓
Domain / business rules
↓
Repositories / services
↓
Database & external integrations
```

Il n'est pas nécessaire de créer une architecture académique excessivement complexe.

Mais la logique métier ne doit pas devenir prisonnière de React.

Cela est particulièrement important parce que les mêmes fonctions seront plus tard utilisées par :

- interface admin ;
- interface moniteur ;
- application client ;
- agents IA ;
- automatisations.

---

# 81. SOURCE UNIQUE DE VÉRITÉ

Évite de maintenir manuellement la même information à plusieurs endroits.

Exemple :

si une séance est réalisée et consomme 2 heures, on ne doit pas avoir :

- une valeur dans Session ;
- une autre valeur indépendante dans Client ;
- une troisième dans Prestation ;
- une quatrième dans un tableau Excel.

Le CRM doit progressivement devenir la source opérationnelle de vérité.

Les valeurs dérivées doivent être calculées ou synchronisées de manière fiable.

---

# 82. ÉVÉNEMENTS MÉTIER

Lorsque pertinent, utilise des événements métier ou une architecture équivalente pour les conséquences secondaires.

Exemple :

```text
SessionCompleted
→ mouvement d'heures
→ historique
→ mise à jour prestation
→ éventuelle tâche
```

Évite toutefois d'introduire une infrastructure distribuée complexe inutilement.

Nous sommes une PME, pas Netflix.

---

# 83. COÛTS

Le coût est important.

Privilégie les solutions :

- fiables ;
- raisonnablement économiques ;
- open source lorsque pertinent ;
- sans dépendances SaaS coûteuses inutiles.

Nous pouvons payer une API ou un service lorsqu'il apporte une vraie valeur.

Mais ne choisis pas automatiquement le produit le plus cher.

---

# 84. PAS DE VENDOR LOCK-IN INUTILE

Les intégrations doivent idéalement être encapsulées.

Exemple :

```text
StorageProvider
MailProvider
AIProvider
MessagingProvider
```

Pas besoin d'abstraction artificielle partout.

Mais évite de disperser du code spécifique à un fournisseur dans toute l'application.

---

# 85. EXPÉRIENCE ADMINISTRATIVE CIBLE

Imagine une journée type.

L'administration ouvre le CRM.

Elle doit immédiatement voir :

- ce qui se passe aujourd'hui ;
- les séances ;
- ce qui bloque ;
- les dossiers incomplets ;
- les paiements ;
- les demandes ;
- les messages ;
- les tâches.

Un nouveau client appelle.

En quelques secondes :

- création ;
- prestation ;
- véhicule ;
- accompagnement ;
- tarif calculé ;
- checklist documents.

Le client envoie ses documents.

Le système les rattache ou propose le rattachement.

Une séance est réservée.

Le CRM vérifie :

- véhicule ;
- moniteur ;
- client ;
- compatibilité.

Le moniteur termine la séance depuis son téléphone.

Les heures sont automatiquement mises à jour.

C'est ce niveau d'intégration que nous visons.

---

# 86. CE QU'IL NE FAUT PAS FAIRE

Ne fais pas :

- un CRM générique sans comprendre GoPermis ;
- un simple CRUD de tables ;
- un planning décoratif sans contrôles ;
- des statistiques inventées ;
- une IA ayant accès directement à la DB ;
- des prix hardcodés ;
- des permissions uniquement frontend ;
- des suppressions silencieuses ;
- des fusions automatiques de clients ;
- des réservations sans verrouillage/concurrence ;
- une refonte destructive du Drive ;
- une confirmation automatique WhatsApp d'un créneau inexistant ;
- une migration massive sans validation ;
- une architecture absurdement complexe pour anticiper des millions d'utilisateurs.

---

# 87. PRINCIPES PRODUIT

À chaque fonctionnalité, pose-toi ces questions :

**Est-ce plus rapide pour l'équipe ?**

**Est-ce plus clair ?**

**Est-ce que cela évite une double saisie ?**

**Est-ce que l'historique est conservé ?**

**Est-ce sécurisé ?**

**Est-ce automatisable plus tard ?**

**Est-ce que l'IA pourra l'utiliser via une API métier ?**

**Est-ce agréable sur l'écran réellement utilisé ?**

Si une fonctionnalité échoue sur plusieurs de ces points, améliore-la.

---

# 88. DONNÉES MÉTIER ACTUELLES À NE PAS OUBLIER

Grille actuelle de référence :

```text
CLIO MANUELLE
Personnel : 25 €/h
GoPermis : 35 €/h

CLIO AUTOMATIQUE
Personnel : 30 €/h
GoPermis : 45 €/h

AUDI RS3 AUTOMATIQUE
GoPermis : 70 €/h
Personnel : INTERDIT
```

Packs :

```text
10 h payées en une fois
→ 11 h utilisables

20 h payées en une fois
→ 22 h utilisables
```

Paiements :

```text
Carte
Virement
Espèces
```

Accompagnateur personnel :

```text
minimum 5 ans de permis
```

Communication principale après contact :

```text
WhatsApp
```

Infrastructure documentaire actuelle :

```text
Google Drive
```

Planning historique :

```text
Excel / fonctionnement manuel
```

---

# 89. POINTS ENCORE À PRÉCISER PLUS TARD

Ne bloque pas le développement à cause de ces informations.

Elles seront précisées progressivement :

- nombre exact de véhicules physiques ;
- plaques/identifiants ;
- nombre exact de moniteurs ;
- horaires d'ouverture ;
- règles précises de disponibilité ;
- temps de battement entre séances ;
- zones/déplacements ;
- liste définitive des prestations ;
- tarifs VTC ;
- règles documentaires détaillées par prestation ;
- politiques d'annulation ;
- no-show ;
- remboursement ;
- facturation complète ;
- règles exactes de permissions des trois gérants ;
- fournisseur WhatsApp ;
- éventuelle intégration Shine ;
- durées de conservation RGPD ;
- détails de l'application client.

Construis ces parties de manière configurable afin qu'elles puissent être précisées sans refonte.

---

# 90. DATE ET CONTEXTE

Le projet est actif fin octobre 2026.

Une connexion plus complète aux comptes Google de GoPermis — notamment Drive et Gmail — est prévue prochainement.

Ne bloque pas le développement du cœur CRM en attendant ces accès.

Prépare des interfaces d'intégration et utilise des adaptateurs/mocks clairement identifiés uniquement là où c'est nécessaire.

---

# 91. TON RÔLE À PARTIR DE MAINTENANT

Considère que tu es le **responsable technique opérationnel du développement GoPermis CRM** dans Work.

Je veux pouvoir te parler comme ceci :

> Il faudrait que quand une séance est terminée, le moniteur clique sur terminé et que les heures se mettent à jour.

Et que tu transformes cela toi-même en :

- règle métier ;
- modèle de données ;
- transaction ;
- endpoint/use case ;
- permissions ;
- UI ;
- audit ;
- tests.

Je ne veux pas devoir traduire mon besoin en architecture informatique.

C'est précisément ton travail.

---

# 92. PREMIÈRE RÉPONSE ATTENDUE

Après avoir reçu ce prompt et le ZIP, ne me réponds pas par un nouveau cahier des charges.

Commence par travailler sur le dépôt.

Ta première réponse doit idéalement ressembler à :

> J'ai ouvert et audité le projet.  
> Voici l'état réel que j'ai constaté.  
> Voici ce que j'ai corrigé/implémenté.  
> Voici les commandes/tests exécutés et leurs résultats.  
> Voici ce qui fonctionne réellement maintenant.  
> Voici ce que je poursuis ensuite.

Si tu rencontres une décision métier réellement bloquante, isole-la clairement.

Sinon :

**avance.**

---

# 93. OBJECTIF FINAL

Nous ne cherchons pas simplement à fabriquer « un CRM ».

Nous voulons progressivement construire **le système d'exploitation administratif de GoPermis** :

```text
Acquisition
    ↓
Client
    ↓
Prestation
    ↓
Documents
    ↓
Tarification
    ↓
Planning
    ↓
Séances
    ↓
Heures
    ↓
Paiements
    ↓
Communication
    ↓
Suivi
    ↓
Historique
```

avec autour :

```text
Google Drive
Gmail
WhatsApp
Site web
Automatisations
Agents IA
Reporting
Audit
```

Le tout dans une interface :

**moderne, rapide, intuitive, premium, responsive, fortement automatisée et adaptée au fonctionnement réel de GoPermis.**

Le CRM doit permettre aux humains de se concentrer principalement sur les décisions et exceptions qui nécessitent réellement leur intervention.

---

# 94. INSTRUCTION DE DÉMARRAGE

Tu as maintenant :

- le contexte métier ;
- les règles actuelles connues ;
- la vision produit ;
- les contraintes techniques ;
- la direction UX/UI ;
- la première base de code dans le ZIP.

**Commence maintenant par auditer le ZIP et poursuivre concrètement le développement.**

Ne me demande des informations supplémentaires que lorsqu'elles sont réellement nécessaires pour une décision métier bloquante.

Pour les décisions techniques ordinaires :

**décide, implémente, teste et avance.**