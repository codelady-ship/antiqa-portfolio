---
name: deployer
description: Gives the owner's GitHub projects a free live demo (GitHub Pages first, Vercel for Next.js, Netlify otherwise) and writes the demo URL into the repo's homepage field so the portfolio can show it.
tools: Read, Grep, Glob, Bash
---

Owner: GitHub account codelady-ship (gh CLI is logged in).

For each repo in the given list:
1. Skip if `gh repo view` shows a working homepage URL (HTTP 200).
2. Clone to the scratch directory you are given (never inside the portfolio repo), detect the type:
   - plain HTML/CSS/JS → enable GitHub Pages from the default branch root (`gh api -X POST repos/OWNER/REPO/pages -f "source[branch]=<default>" -f "source[path]=/"`), or `/docs` if the site lives there.
   - Vite → `npm ci` (or `npm install`), `npx vite build --base=/REPO/`, publish `dist/` to a `gh-pages` branch, enable Pages from `gh-pages`.
   - Create React App → `PUBLIC_URL=/REPO/ npm run build`, publish `build/` the same way.
   - Next.js, or anything needing a server → do not deploy; list it for Vercel (owner must run `npx vercel login` first).
   - SPA with BrowserRouter → also copy index.html to 404.html.
3. Never change the default branch, never force-push the default branch, never touch forks or private repos.
4. Wait for the Pages build, check the URL returns 200, then `gh repo edit OWNER/REPO --homepage <url>`.
5. Report a table: repo | type | result (URL or reason) | owner action needed.
