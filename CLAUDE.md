# Askwell — Règles de l'équipe

Askwell est un widget de chat d'assistance basé sur l'IA, compatible avec n'importe quel site web. Il est développé par une équipe d'agents basée au siège de JSM. Chaque agent doit respecter ce document. Le siège de JSM ajoute votre rôle, l'équipe, les règles de workflow et vos outils au début de votre session.

## Documentation

| Fichier | À lire pour |
|---|---|
| `docs/project.md` | Ce que nous développons : fonctionnalités, modèle de données, routes API, règles de sécurité, conception |
| `docs/plan.md` | Les phases, par ordre de développement (rédigé par des humains) |

Votre tâche (à partir de `get_my_task`) répertorie les sections de `project.md` dont elle a besoin. Lisez celles-ci, et non l’intégralité du fichier.

## Comment communiquer avec le Product Owner

- Commencez par la réponse ou le résultat. Pas de préambule, pas de récapitulatif à la fin.
- Des phrases courtes, des mots simples. Pas de paragraphe de plus de 3 phrases.
- Un tableau pour les comparaisons, une liste numérotée pour les étapes. Du texte brut pour une réponse courte.
- Besoin d’une décision ? Utilisez l’outil AskUserQuestion : 2 à 4 options, la recommandée en premier, marquée « (Recommandée) », une ligne expliquant pourquoi pour chacune.
- Une décision à la fois, sauf si elles sont liées. Jamais plus de 3.
- Précisez ce que vous savez par opposition à ce que vous supposez.

## Avant d’ouvrir une pull request (PR)

- Effectuez toutes les vérifications (voir Commandes). Toutes doivent être réussies.
- Corps de la pull request : ce qui a changé, comment vous l’avez testé, et la liste des critères de réussite de la tâche, chaque élément étant coché ou expliqué.
- Vercel déploie un aperçu de chaque pull request. Vérifiez-y votre modification et ajoutez l’URL de l’aperçu dans la pull request. Si le dépôt n’est pas encore connecté à Vercel (début de la phase 0), indiquez-le dans la pull request et ignorez cette vérification.

## Vérification de votre modification sur un aperçu Vercel

- Récupérez l’URL de l’aperçu depuis GitHub, jamais à partir du nom de la branche (Vercel raccourcit les noms longs) : via le commentaire Vercel sur votre PR (`gh pr view <n> --comments`), ou via le statut de déploiement de la PR (`gh api repos/<owner>/<repo>/deployments?ref=<branch>`). Attendez que le déploiement aboutisse.
- Les aperçus sont protégés. Envoyez l’en-tête `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` à chaque requête. Pour les tests dans le navigateur, envoyez également `x-vercel-set-bypass-cookie: true` lors de la première requête.
- Si une URL d’aperçu est bloquée par votre sandbox, appelez `request_access` pour `*.vercel.app` (tous les aperçus) plutôt que pour l’URL unique.

## Quand vous devez vous arrêter et demander confirmation

| Situation | Que faire |
|---|---|
| Vous devez modifier `packages/shared`, ou modifier ou supprimer une table ou une colonne existante | Arrêtez-vous. Il s’agit d’une modification du contrat. Le chef de projet la planifie ; le Product Owner l’approuve. |
| La tâche n’est pas claire ou entre en conflit avec `project.md` | Arrêtez-vous. Demandez. Ne devinez pas. |
| Vous avez besoin d’un compte, d’une clé ou d’une identification | Arrêtez-vous. Précisez exactement ce dont vous avez besoin et où cela doit aller (par exemple, dans votre fichier d’environnement). Les comptes et les identifications relèvent de la responsabilité du Product Owner. |

## Révisions et votre prochaine tâche

- Corrigez tous les commentaires valides de CodeRabbit ou du chef de projet sur la même branche. Si un commentaire est erroné, répondez sur la pull request en expliquant pourquoi. Répondez à tous les fils de discussion.
- Une fois votre pull request ouverte, le chef de projet peut vous attribuer votre prochaine tâche. Effectuez-la sur une nouvelle branche dérivée de `main`.
- Lorsque des commentaires de révision arrivent sur une pull request antérieure, revenez sur cette branche, corrigez, effectuez un push, puis revenez. N’appelez pas `set_my_status` pour la tâche antérieure : cela mettrait à jour votre tâche en cours. Le siège social assure lui-même le suivi de la pull request antérieure.
- Ne commencez jamais une tâche qui nécessite du code provenant de l’une de vos pull requests ouvertes. Si rien d’indépendant n’est prêt, signalez-le.
- Ne fusionnez jamais votre propre PR, ne poussez jamais vers `main`, ne forcez jamais la poussée d’une branche en cours de révision.

## Règles relatives à la base de données

- L’application accède à la base de données uniquement via `supabase-js` : `createOwnerClient()` (jeton Clerk du propriétaire, RLS s’applique) et `createServiceClient()` (clé secrète, serveur uniquement), tous deux situés dans `apps/web/lib/supabase`.
- Les migrations sont des fichiers SQL situés dans `supabase/migrations`, nommés `<horodatage UTC>_<nom>.sql`, plus récents que la dernière version présente sur `main`. Ne modifiez jamais une migration déjà fusionnée.
- Chaque nouvelle table ou fonction est fournie avec ses politiques RLS et ses autorisations dans la même migration (voir `project.md` §7 et §9). N’ajoutez une nouvelle table ou colonne que si votre tâche le précise.
- Testez les migrations, les politiques et les fonctions sur pglite (`packages/db/supabase-pglite.ts`). N’exécutez jamais une pile Supabase locale ni une base de données Docker.
- Le projet de développement Supabase est partagé par tous les développeurs et toutes les versions préliminaires. Ses données sont jetables, mais n’y appliquez jamais une migration non fusionnée. Une fois votre PR fusionnée, appliquez-la au projet de développement via le MCP Supabase, en notant la version du fichier, puis régénérez les types (à l’aide du générateur de types du MCP) et vérifiez qu’il n’y a pas de différence.
- Le MCP Supabase est limité au projet « dev ». Ne touchez jamais à la base de données de production. Le responsable produit applique les migrations à la production avant de valider la version.
- Les migrations sont additives : la version en production doit continuer de fonctionner pendant l’exécution d’une migration. La suppression ou le renommage d’une table ou d’une colonne s’effectue dans une pull request ultérieure, une fois qu’aucun code déployé ne l’utilise plus.

## Règles de sécurité

`docs/project.md` §9 répertorie toutes les règles. Celles que vous ne devez jamais enfreindre :

- Lisez le plan sur le serveur lors de chaque action contrôlée. Ne faites jamais confiance au client.
- Les lectures par le propriétaire passent par le client propriétaire ; elles sont donc soumises aux restrictions RLS. N’utilisez jamais le client de service avec un filtre de propriétaire manuel ; utilisez-le uniquement après que la route a vérifié la propriété.
- Affichez les messages des visiteurs et les réponses des bots sous forme de texte, jamais en HTML.
- Aucun secret dans `NEXT_PUBLIC_*`, le bundle de widgets ou un commit. Ne supprimez jamais `.env` de `.gitignore`.

## Conventions de code

| Domaine | Règle |
|---|---|
| Types | TypeScript `strict`. Pas de `any`. Importez les types API depuis `packages/shared` ; ne les redéfinissez jamais. |
| Entrées API | Un schéma Zod par route, à côté de son type dans `packages/shared` |
| Erreurs API | `{ error: { code, message } }` avec le statut HTTP approprié |
| Tests | Vitest. Au moins un test par route et par fonction pure. |
| Nouvelle dépendance | Autorisée. Indiquez son nom et la raison dans le corps de la pull request. |
| Interface utilisateur | Respectez la section 13 « Design » du fichier `project.md`. Réutilisez les composants de `apps/web/components`. |
| Nom de l’application | `APP_NAME` issu de `packages/shared`. Ne le codez jamais en dur. |

## Commandes

| Commande | Action |
|---|---|
| `pnpm dev` | Exécute l’application localement |
| `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` | Vérifications. Toutes doivent réussir avant un PR. |
| `pnpm db:types` | Régénère `packages/db/types.ts` à partir du projet de développement (nécessite `SUPABASE_ACCESS_TOKEN` ; les agents utilisent plutôt le générateur de types du MCP) |