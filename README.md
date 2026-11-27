# Portail Scolarité Uu

Portail de gestion de la scolarité, des inscriptions universitaires et d'édition des certificats de scolarité de l'Université de Toliara.

> Application 100 % front-end : les données sont conservées dans le navigateur (localStorage). Aucun backend ni clé API n'est nécessaire pour le build ou la production.

## Développement local

**Prérequis :** Node.js `^20.19.0` ou `>=22.12.0` (la version exacte est aussi épinglée dans `.node-version`).

1. Installer les dépendances : `npm install`
2. Lancer l'application : `npm run dev` (port 3000)
3. Vérifier : `npm run lint` · `npm test` · `npm run build`

## Déploiement sur Cloudflare Pages

Dans le tableau de bord Cloudflare Pages → votre projet → **Settings → Build & deployments** :

| Paramètre | Valeur |
| --- | --- |
| Framework preset | `None` (ou `Vite`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |

Points importants :

- **Node.js** : Vite 8 exige Node `^20.19.0 || >=22.12.0`. Le fichier `.node-version` (`22.12.0`) est lu automatiquement par Cloudflare Pages — ne pas le supprimer. Sans lui, le build échoue (version de Node par défaut trop ancienne).
- **Gestionnaire de paquets** : le projet utilise **npm** (`package-lock.json`). Ne pas ajouter de `bun.lock` / `yarn.lock` / `pnpm-lock.yaml` dans le dépôt, sinon Cloudflare choisira automatiquement ce gestionnaire.
- **Variables d'environnement** : aucune n'est requise. `GEMINI_API_KEY` (voir `.env.example`) n'est pas utilisée par le code.
- **SPA** : `public/_redirects` contient `/* /index.html 200` ; il est copié tel quel dans `dist` pour que toutes les routes servent l'application.
- Les assets statiques sont référencés en chemins absolus (`/assets/...`) : le site doit être servi à la racine du domaine (ex. `https://<projet>.pages.dev` ou domaine personnalisé), pas dans un sous-dossier.

Après chaque `git push` sur la branche de production, Cloudflare Pages rebuild et redéploie automatiquement.
