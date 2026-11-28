# Portail Scolarité Uu

Portail de gestion de la scolarité, des inscriptions universitaires et d'édition des certificats de scolarité de l'Université de Toliara.

> Application 100 % front-end : les données sont conservées dans le navigateur (localStorage). Aucun backend ni clé API n'est nécessaire pour le build ou la production.

## Développement local

**Prérequis :** Node.js `^20.19.0` ou `>=22.12.0` (la version exacte est aussi épinglée dans `.node-version`).

1. Installer les dépendances : `npm install`
2. Lancer l'application : `npm run dev` (port 3000)
3. Vérifier : `npm run lint` · `npm test` · `npm run build`

## Déploiement sur Cloudflare (Workers Builds)

Le site est déployé par **Cloudflare Workers Builds** (assets statiques) et non par Cloudflare Pages :

| Paramètre (dashboard Cloudflare) | Valeur recommandée |
| --- | --- |
| Build command | `npm run build` (actuellement `bun run build` — ça fonctionne, mais npm est le chemin testé) |
| Deploy command | `npx wrangler deploy` |
| Framework | Vite (auto-détecté) |
| Production branch | `main` |

Points importants :

- **Node.js** : Vite 8 exige Node `^20.19.0 || >=22.12.0`. Le fichier `.node-version` (`22.12.0`) est lu automatiquement par le builder — ne pas le supprimer.
- **Gestionnaire de paquets** : le projet utilise **npm** (`package-lock.json`). Ne pas ajouter de `bun.lock` / `yarn.lock` / `pnpm-lock.yaml` dans le dépôt.
- **SPA fallback** : déjà géré par la config des assets wrangler (`not_found_handling: single-page-application`, auto-configurée au premier `wrangler deploy`). **Ne pas ajouter de `public/_redirects` avec `/* /index.html 200`** : l'API Workers Assets le rejette (`Infinite loop detected`, code `100324`) et fait échouer le déploiement.
- **Variables d'environnement** : aucune n'est requise. `GEMINI_API_KEY` (voir `.env.example`) n'est pas utilisée par le code.
- Les assets statiques sont référencés en chemins absolus (`/assets/...`) : le site doit être servi à la racine du domaine, pas dans un sous-dossier.
