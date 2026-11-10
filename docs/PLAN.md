# Antiqa Portfolio — Architecture & 3-day plan

Owner: Antiqa Cəlilova (codelady-ship). Architect / reviewer: `.claude/agents/architect-reviewer.md`.
Rule: only technologies the owner already uses (MERN, Next.js, TypeScript, Tailwind, Three.js, Git). Max 3 days.

## Stack decisions

| Area | Decision | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind 4 | Same as Jeparla; SSG/ISR pages give full SEO HTML |
| i18n | next-intl, routes `/az` and `/en`, `hreflang` | Used in Jeparla |
| Theme | next-themes (`light` / `dark` / system), CSS tokens | Used in Jeparla |
| Motion | CSS sticky tracks + own `scrub.ts` timeline + `Reveal` (from Jeparla), no GSAP | Keeps the 250 KB script budget |
| 3D | Three.js (lazy, after first paint): triangle-particle hero, project-card sphere | Owner used Three.js in the old portfolio |
| Backend | Node.js + Express + Mongoose (TypeScript) | Owner's MERN course |
| DB | MongoDB Atlas free M0 | Free, owner has used it (task6.mongodb) |
| Auth | One admin, JWT in httpOnly cookie, bcrypt hash in env | Owner did task8-JWT |
| Hosting | Frontend + API on Vercel (API as serverless Express) | Free, one place |
| Demo hosting for old projects | GitHub Pages (static / Vite / CRA) via `gh`; Next.js → Vercel; else Netlify | Free |

## How a project gets on the site
1. Admin panel → paste GitHub URL → `POST /api/projects`.
2. API reads GitHub: name, description, created/pushed dates, languages (%), topics, stars, homepage, license, README.
3. Demo URL = manual override → repo homepage → GitHub Pages.
4. Card shows info; hover plays a live mini preview; "Demo" button opens a modal with a scrollable iframe (desktop / tablet / phone widths) + README tab.
5. Nightly / on-demand `POST /api/projects/sync` refreshes GitHub data; frontend uses ISR (revalidate) so pages stay static.

## API (v1)
- `GET /api/profile` · `PUT /api/profile` (admin) — name, roles, about (az/en), contacts, skills, open-to-work
- `GET /api/projects` · `POST /api/projects` · `PATCH /api/projects/:id` · `DELETE /api/projects/:id` · `POST /api/projects/sync`
- `GET /api/cv/:lang` · `PUT /api/cv/:lang` (admin, PDF ≤ 2 MB, stored in Mongo)
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/health`

## SEO / GEO
Per-locale metadata, canonical + hreflang, `sitemap.xml`, `robots.txt`, JSON-LD (`Person`, `WebSite`, `ItemList` of `SoftwareSourceCode`), OG image per locale, `llms.txt` + `/en/about` plain facts for AI answer engines, semantic HTML, Lighthouse ≥ 90 on mobile (perf, a11y, best practices, SEO).

## Days (each issue = one PR, reviewed by architect-reviewer before merge)

### Day 1 — foundation + look
- #1 Monorepo scaffold: `frontend/` (Next) + `backend/` (Express), lint, CI build
- #2 Design system: tokens (light/dark), fonts, theme toggle, az/en switch, layout, nav, footer
- #3 Hero: triangle-particle Three.js scene + giant editorial name, scroll-scrubbed exit
- #4 Sections: about, skills marquee, contact (static data for now), Reveal animations
- #D Deploy agent: ~15 selected repos get live demos + repo homepage set

### Day 2 — API + projects
- #5 Backend: Express app, Mongo models, GitHub sync service, public endpoints, tests
- #6 Auth + admin endpoints, CV upload
- #7 Projects section: card grid + hover preview + demo modal; 3D sphere of cards on scroll
- #8 Admin panel UI (`/admin`): profile, contacts, CV, add project by GitHub URL

### Day 3 — quality + launch
- #9 SEO/GEO pack (metadata, JSON-LD, sitemap, OG images, llms.txt)
- #10 Performance + a11y + responsive pass (Lighthouse CI budget)
- #11 Vercel deploy (frontend + API), env vars, move `antiqacode.vercel.app` domain

## Owner actions (only she can do)
- MongoDB Atlas: create free cluster, send connection string (or put it in Vercel env).
- Vercel: `npx vercel login` once (for Next.js demos and the final deploy).
- Choose the admin password (stored only as a bcrypt hash).
