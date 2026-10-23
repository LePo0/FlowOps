# Décisions

Les choix qui structurent FlowOps, avec leurs raisons et ce qui a été écarté. Le fonctionnement détaillé est dans [architecture.md](architecture.md), la sécurité dans [security/](security/).

## Architecture

### Monolithe modulaire en monorepo

Un seul dépôt (npm workspaces) : `apps/web`, `apps/api`, `packages/shared`, `e2e`. Une seule API, découpée en modules : moteur, workflows, exécutions, authentification.

- **Pourquoi** : un développeur, un produit, un déploiement. Le contrat du workflow est partagé entre l'éditeur et l'API sans paquet publié ni versions à synchroniser.
- **Écarté** : des microservices (moteur d'exécution séparé, file de messages). Ils ajouteraient du réseau, des déploiements et de la cohérence à gérer, sans besoin de passer à l'échelle aujourd'hui.

### Un seul contrat, en Zod, partagé

Le graphe d'un workflow est décrit une fois, en schémas Zod (`packages/shared`). L'API valide les requêtes avec, l'éditeur valide ses formulaires et les réponses de l'API avec, et TypeScript en déduit les types.

- **Pourquoi** : une seule source de vérité. Un champ ajouté côté API est vérifié par le compilateur côté éditeur.
- **Conséquence** : le modèle ne dépend pas de React Flow. L'éditeur convertit (`toGraph()` / `fromGraph()`) : on pourrait changer de bibliothèque de canvas sans toucher au moteur ni à la base.

### Moteur en TypeScript pur, `fetch` injecté

Le moteur ne connaît ni Express, ni Prisma, ni le réseau : il reçoit un graphe et une fonction `fetch`.

- **Pourquoi** : il se teste sans réseau et vite (près de 200 tests). La sécurité du nœud HTTP est une implémentation de `fetch` qu'on fournit, pas des conditions dispersées dans le code.

### L'historique garde une copie du graphe exécuté

Chaque exécution enregistre le graphe tel qu'il a tourné, pas une référence au workflow.

- **Pourquoi** : modifier un workflow ne réécrit pas son passé. Une ancienne exécution reste lisible, et la relance rejoue exactement ce qui a tourné.
- **Coût accepté** : du stockage en plus, borné aux 50 dernières exécutions par workflow (10 en session de démo).

### Condition en égalité stricte

La condition compare avec `===`, et l'éditeur fait choisir le type de la valeur attendue (texte, nombre, booléen).

- **Pourquoi** : `"200" == 200` vrai en silence est une source classique de bugs dans les outils d'automatisation. Mieux vaut un choix visible au moment de configurer.

## Sécurité

### Le nœud HTTP suit une politique réseau, pas un blocage figé

Par défaut, seules les adresses publiques sont joignables. Un administrateur peut ouvrir des réseaux internes par variable d'environnement. La boucle locale et le serveur de métadonnées du cloud restent toujours interdits. La décision porte sur l'adresse IP réellement contactée, redirections comprises.

- **Pourquoi** : le même produit doit servir en SaaS public, sans aucun accès interne, et installé en entreprise, où appeler les API internes est le but. Bloquer toutes les adresses privées rendrait le second usage impossible.
- **Méthode** : scénarios d'attaque rédigés avant le code, traduits en tests qui échouaient d'abord ([security/http-node.md](security/http-node.md)).

### Vérifier les jetons Firebase avec `jose`, pas `firebase-admin`

- **Pourquoi** : `firebase-admin` renvoie la même erreur pour un jeton falsifié et pour une panne réseau (clés de Google injoignables). L'API doit répondre `401` dans le premier cas et `500` dans le second. Avec `jose`, chaque vérification demandée par la documentation Firebase est explicite, et testée avec des jetons signés localement.

### Jetons dans l'en-tête, pas de cookie

- **Pourquoi** : sans cookie, pas de CSRF à gérer. L'API ne sert qu'un éditeur, sur la même origine en production.

### Isolation par utilisateur : 404 plutôt que 403

Une ressource d'un autre utilisateur répond comme une ressource inexistante.

- **Pourquoi** : un `403` confirmerait qu'elle existe.

## Accès sans compte

### Une session de démo privée par visiteur

Sans compte, le visiteur reçoit un compte anonyme Firebase, prérempli de trois workflows d'exemple, avec des quotas réduits et une suppression après 7 jours sans visite. Il peut le transformer en vrai compte sans perdre ses workflows. Détail : [security/demo-sessions.md](security/demo-sessions.md).

- **Pourquoi** : FlowOps est un projet de portfolio. Un recruteur doit pouvoir tout essayer sans s'inscrire, y compris l'historique et la relance, qui demandent un workflow enregistré.
- **Écarté** :
  - un **compte de démo partagé** : les visiteurs verraient et modifieraient les données des autres, et l'un d'eux pourrait changer le mot de passe ;
  - un **mode invité sans enregistrement** : plus simple, mais l'historique et le débogage, points forts du projet, ne seraient pas visibles.

### Borner le coût plutôt qu'empêcher tout abus

Les exécutions sont limitées par compte et par adresse IP, les sessions de démo ont des quotas de stockage, Cloud Run est limité à 2 instances, et un plafond de dépenses coupe le service.

- **Pourquoi** : un abus déterminé (beaucoup d'adresses, beaucoup de comptes) ne se bloque pas complètement sans captcha ni service payant. Ces limites coûtent peu et bornent le pire cas à une somme choisie d'avance. Un captcha reste une réponse possible si un abus apparaît.
- **Compteurs en mémoire** : approximatifs (propres à chaque instance, remis à zéro au redémarrage), acceptés avec 2 instances au plus. Une base partagée comme Redis n'est pas justifiée à ce volume.

## Déploiement

### Cloud Run et Firebase Hosting, sur une seule adresse

Hosting sert l'éditeur et réécrit `/api/**` vers Cloud Run : l'éditeur et l'API partagent l'origine `flowops.vincent-angoulvant.fr`.

- **Pourquoi** : ni CORS ni second sous-domaine, comme le proxy de Vite en local. Cloud Run se met à zéro sans trafic et redémarre en quelques secondes, avec un quota gratuit large.
- **Écarté** :
  - **Render** (gratuit sans carte bancaire) : environ une minute de réveil après 15 minutes sans trafic, et l'API sur un second domaine ;
  - **Vercel, Cloudflare Workers** : la protection du nœud HTTP contrôle elle-même la résolution DNS et la connexion, et les limites d'exécution supposent un processus qui dure.

### Neon pour PostgreSQL

- **Pourquoi** : offre gratuite, PostgreSQL standard (Prisma inchangé), mise en veille sans trafic avec un réveil automatique.
- **Écarté** : **Supabase**, dont l'offre gratuite met en pause un projet inactif 7 jours jusqu'à une action manuelle ; **Cloud SQL**, environ 10 € par mois au minimum.

### Déploiement sans clé stockée

GitHub Actions obtient une identité Google de courte durée (Workload Identity Federation), réservée à la branche `main` de ce dépôt. Chaque compte de service n'a que les droits de sa tâche. La configuration est décrite dans le dépôt, pas seulement dans une console ([deploy/README.md](../deploy/README.md)).

- **Pourquoi** : une clé de compte de service copiée dans GitHub est un secret durable qui finit par fuiter. Ici, rien à faire tourner ni à révoquer.

### Aucun `.env` versionné

Même la configuration web de Firebase, publique par nature, vient des variables GitHub au moment du build.

- **Pourquoi** : une règle sans exception reste simple à vérifier. Une clé web commitée par erreur a été remplacée, plutôt que de réécrire l'historique Git.
