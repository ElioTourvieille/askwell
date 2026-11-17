# Plan

Ordre de construction pour Askwell. Le fichier `docs/project.md` décrit chaque fonctionnalité en détail.

## Règles

- Effectuez les phases de construction dans cet ordre. N’ajoutez pas, ne supprimez pas et ne réorganisez pas les phases.
- Chaque phase après la phase 0 comporte deux pistes parallèles, une par développeur, afin que personne n’ait à attendre.
- Chaque phase correspond à un tableau dans JSM HQ. Le chef de projet crée le tableau et y ajoute les tâches, en collaboration avec le Product Owner, avant le début de la phase. La phase suivante peut être décomposée pendant que la phase en cours est en cours de construction.
- Les tâches et leur statut n’existent que dans JSM HQ. Ce fichier ne répertorie jamais les tâches.
- Une phase est terminée lorsque toutes ses tâches ont été fusionnées et que ses vérifications « Done when » ont été validées sur la dernière préversion Vercel. La mise en production n’a lieu qu’une seule fois, lors de la phase 6.
- Chaque phase répertorie les clés dont elle a besoin. Lorsqu’un agent atteint une étape nécessitant une clé, il s’arrête et en fait la demande (voir `CLAUDE.md`), puis le Product Owner l’ajoute. Les agents ne créent jamais de comptes ni ne gèrent de clés brutes dans le chat.
- Veillez à ce que l’option « Exporter le plan vers docs/plan.md » de JSM HQ soit désactivée. Elle écraserait ce fichier.

---

## Phase 0 — Configuration

**Objectif :** une application vide qui se compile et se déploie. C’est la seule phase comportant une seule voie, car tout le reste s’appuie sur elle.

**Voies :** une. Le chef de projet la planifie comme n’importe quelle autre phase et attribue chaque tâche à un développeur.

**Clés requises :** aucune au départ. Le Product Owner connecte Vercel au cours de cette phase, avant sa dernière tâche : il importe le dépôt (promotion automatique désactivée), autorise `*.vercel.app` dans le bac à sable de chaque développeur et ajoute `VERCEL_AUTOMATION_BYPASS_SECRET` au fichier d’environnement de chaque développeur (Vercel → Protection du déploiement → Contournement de la protection pour l’automatisation). Le chef de projet prévoit la vérification Vercel comme dernière tâche.

| Comprend                                                                                           | project.md |
| --------------------------------------------------------------------- ----                         | ---------- |
| Monorepo avec `apps/web`, `apps/widget`, `packages/shared`, `packages/db`                          | §10        |
| Application Next.js avec TypeScript et Tailwind                                                    | §3         |
| Projet Vercel : un aperçu par PR, production à partir de `main` (promotion automatique désactivée) | §3, §4     |
| `.env.example` avec toutes les variables                                                           | §11        |

**Terminé lorsque :** une PR obtient une URL d’aperçu Vercel et que la page d’accueil s’y charge.

---

## Phase 1 — Fondations

**Objectif :** le contrat partagé, la base de données, la connexion et l'interface publique de l'application.

**Clés requises :** le projet Neon de développement (`NEXT_PUBLIC_NEON_DATA_API_URL`, `DATABASE_URL` du rôle `app_service`) avec l’API Data activée, le MCP Neon associé à chaque développeur et limité au projet de développement, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, ainsi que Clerk configuré comme fournisseur d’authentification de l’API Data de Neon (JWKS de Clerk, claim `role: authenticated` dans le jeton de session)

| Piste                        | Comprend                                                                                                                                                | project.md |
| --------------------------- | --------------------------------------------------------------------- --------------------------------------------------------------------------------- - | ---------- |
| **A — Contrat + base de données** | Migrations Neon pour toutes les tables, pgvector, politiques et autorisations RLS, rôle `app_service` (vérifier qu’il contourne RLS sans être membre de `neon_superuser`), script `pnpm db:migrate` et table `schema_migrations`, clients propriétaire et de service, helper pglite, types générés. Types partagés pour chaque route API. Limites du forfait.           | §5, §7, §8 |
| **B — Authentification + interfaces**       | Connexion / inscription à Clerk, middleware, ligne `accounts` lors de la première connexion, mise en page du tableau de bord vide avec navigation, page d’accueil (statique, pas encore de widget en direct) | §6.1, §6.2, §13 |

**Terminé lorsque :** les migrations sont exécutées en environnement de développement ; un nouvel utilisateur s’inscrit et accède à un tableau de bord vide ; la page d’accueil est en ligne.

---

## Phase 2 — Projets + widget

**Objectif :** un propriétaire peut créer un projet et voir le widget sur n’importe quel site web. Les réponses sont factices pour l’instant.

**Clés requises :** `NEXT_PUBLIC_APP_URL` (pas de nouveaux services)

| Voie             | Comprend                                                                                                    | project.md     |
| ---------------- | ------------------------------- --------------------------------------------------------------------------- - | -------------- |
| **A — Projets** | CRUD des projets + limite version gratuite/pro, `public_key`, configuration par défaut du widget, page d’installation, `GET /api/widget/config` | §6.3, §6.9, §8 |
| **B — Widget**   | Script de chargement (bouton, iframe, `postMessage`), interface utilisateur du panneau `/embed` avec des réponses factices, identifiant du visiteur              | §6.5           |

**Terminé lorsque :** création d’un projet → copie de l’extrait de code → une page HTML simple sur une autre origine affiche le bouton → le panneau s’ouvre et affiche une réponse factice.


---

## Phase 3 — Connaissances + chat

**Objectif :** le bot répond à de vraies questions à partir des documents du propriétaire.

**Clés requises :** `OPENAI_API_KEY`, `ARCJET_KEY`, `NEON_STORAGE_*` (le compartiment `knowledge` est créé avec le MCP Neon ou la CLI Neon, pas par une migration ; son CORS autorise l’origine de l’application)

| Voie              | Comprend                                                                                                                              | project.md |
| ----------------- | ------------------------------------------------------------------------------- ------------------------------------------------------ | ---------- |
| **A — Connaissances** | Coller du texte + télécharger des fichiers PDF/MD/TXT directement dans Neon Object Storage avec des URL présignées, extraction de texte, découpage en segments, représentations vectorielles, page « Connaissances » avec statut de la source, suppression, limite de fichiers | §6.4       |
| **B — Chat**      | Limite de débit Arcjet + détection d’injection de prompts, `POST /api/widget/chat` : quota, récupération, réponse, enregistrement, comptage. Connectez-y le panneau `/embed`.                         | §6.6       |

La voie B teste la récupération avec des segments pré-définis jusqu’à ce que la voie A soit fusionnée.

**Terminé lorsque :** téléchargement d’un PDF → question à son sujet sur la page HTML simple → réponse correcte ; question sans rapport → « Je ne sais pas » ; le 21e message en une minute est refusé.

---

## Phase 4 — Conversations + analyses

**Objectif :** le responsable du produit voit ce que les visiteurs demandent, et nous observons comment le produit est utilisé.

**Clés requises :** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. L’assistant nécessitant une connexion via un navigateur, le responsable produit l’exécute dans l’environnement de test du développeur (onglet Bash du siège). Le développeur examine ensuite les modifications apportées et construit le reste de la piste.

| Piste                          | Comprend                                                                                             | project.md  |
| ---------------------------- - | ------------------------------------------------------------------------------------------------- --- | ----------- |
| **A — Conversations + utilisation** | Liste des conversations + fil de discussion, affichage de l’utilisation par projet                                               | §6.7, §6.12 |
| **B — Analyses**             | Assistant PostHog, événements produit, entonnoir, relecture de session, suivi des erreurs, traçage IA dans le parcours du chat | §6.11       |

**Terminé lorsque :** un widget de chat apparaît dans « Conversations » après l’actualisation ; le compteur d’utilisation augmente ; PostHog affiche les événements et un tracé IA avec son coût.


---

## Phase 5 — Facturation + personnalisation

**Objectif :** les versions Free et Pro fonctionnent de bout en bout.

** Clés requises :** `CLERK_WEBHOOK_SIGNING_SECRET`. Dans le tableau de bord Clerk : facturation activée via la passerelle de paiement Clerk (mode test), forfaits `free` et `pro`, et un webhook vers `/api/clerk/webhook` avec les événements d’abonnement.

| Voie              | Comprend                                                                                                                       | project.md |
| ---- ------------- | ------------------------------------------------------------------------------------- ----------------------------------------- | ---------- |
| **A — Facturation**   | Webhook Clerk → `accounts.plan`, page de facturation avec le tableau des tarifs de Clerk et le portail de compte | §6.10      |
| **B — Personnalisation** | Page de personnalisation avec aperçu en direct, `PATCH /api/projects/:id/config` renvoyant un 402 pour la version gratuite, configuration liée au forfait dans le widget, badge | §6.8       |

La piste B met d’abord en place le chemin 402, puis teste la version Pro en définissant manuellement `accounts.plan` jusqu’à ce que la piste A soit fusionnée.

**Terminé lorsque :** enregistrement en version gratuite → 402 → mise à niveau avec une carte de test → l’enregistrement fonctionne → le widget affiche la nouvelle couleur au rafraîchissement.


---

## Phase 6 — Renforcement + lancement

**Objectif :** le flux principal fonctionne sur `main`, sans faille de sécurité ouverte.

**Clés requises :** `LANDING_WIDGET_KEY` (la clé publique d’un projet concernant Askwell lui-même, créée dans l’application). À la fin, le Product Owner crée le projet Neon de production (région compatible Object Storage), y active l’API Data et configure les variables de production de Vercel.

| Voie             | Comprend                                                                                                    | project.md |
| ---------------- | -------------------------------------------------------------------------------- --------------------------- | ---------- |
| **A — Sécurité** | Corriger les résultats d’audit en suspens, en-têtes de sécurité (`frame-ancestors`), vérification CORS, dernière vérification de chaque règle du §9  | §9         |
| **B — Lancement**   | La page d’accueil exécute le widget propre à l’application, optimisation de la réactivité et de l’état vide, exécution du flux principal complet sur `main` | §2, §6.1   |

**Terminé lorsque :** le Product Owner crée le projet Neon de production, y active l’API Data, crée le rôle `app_service` et le compartiment `knowledge`, y applique toutes les migrations, configure les variables de production de Vercel et déploie la version ; ensuite, les neuf étapes du flux principal (§2) sont validées sur l’URL de production.


*** Traduit avec www.DeepL.com/Translator (version gratuite) ***

