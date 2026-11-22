# Admin panel — how to add projects and CVs

**Address:** https://antiqa-portfolio.vercel.app/az/admin (English: `/en/admin`).
The site has no public link to it on purpose — bookmark it. It is `noindex`.
Log in with the admin email and password (set as `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` on the API).

**Forgot the password?** Press "Forgot password?" under the sign-in form, enter the admin email and open the
link that arrives (valid 30 minutes, works once). Set the new password twice: every device is signed out and
you sign in with the new password. From then on the password lives in the database, not in `ADMIN_PASSWORD_HASH`
(which stays only as the password used until the first reset). This needs `RESEND_API_KEY` on the API, see below.

At the top you see three big buttons:

## 1. Add a project from GitHub
1. **Pick from my repos** (lists your GitHub repos, newest first; already added ones are greyed out)
   — or paste a repo link, e.g. `https://github.com/codelady-ship/planera` — and press **Read from GitHub**.
2. The form fills in by itself: title, description (from the repo, or the README's first paragraph),
   languages %, stars, created / updated dates and the **live link**, found in this order:
   1. the repo's *Website* (homepage) field on GitHub;
   2. the Vercel project linked to the repo (only when `VERCEL_TOKEN`, optionally `VERCEL_TEAM_ID`, is set on the API);
   3. `https://<repo-name>.vercel.app` if something answers there — shown in red: check it, it may be someone else's site;
   4. GitHub Pages, when Pages is on for the repo.
3. Edit the AZ / EN description if you like, tick **Featured** / **Coming soon**, press **Add to the site**.
   It is saved in MongoDB and appears on the site within seconds.

Private repos can be added too (the API's `GITHUB_TOKEN` must be able to read them): tick
"Private repo — show without a code link". The site then shows no code link and no README.

In the list below, each project has: Featured, Hidden, **Coming soon** (badge instead of a live link),
**Demo is broken — show as code only**, and ▸ details (title, AZ/EN text, demo link, backend repo, order, delete).
"Refresh all from GitHub" re-reads stars, languages and dates for every project.

## 2. Upload a CV (AZ / EN)
Pick a PDF (≤ 2 MB) for each language. The "Download CV" buttons on the site switch to it at once.

## 3. Profile and experience
Name, about text, work experience (role, company, period, summary — AZ and EN), education, skills and contacts.

## API environment (Vercel → backend project → Settings → Environment Variables)
- `GITHUB_TOKEN` — read access to your repos (fine-grained: Contents + Metadata read-only; add private repos you want to show).
- `GITHUB_OWNER` — optional, defaults to the GitHub user in your profile (`codelady-ship`).
- `VERCEL_TOKEN`, `VERCEL_TEAM_ID` — optional, lets "Add from GitHub" find Vercel live links.
- `RESEND_API_KEY` — needed for "Forgot password?" (Production only). Create a free account at resend.com **with the
  same address as `ADMIN_EMAIL`** (without an own domain Resend delivers only to the account's address), then
  API Keys → Create API key → "Sending access". Until it is set, the reset flow sends nothing.
- `MAIL_FROM`, `SITE_URL` — optional: sender after verifying a domain in Resend; site address for the reset link
  (default `https://antiqa-portfolio.vercel.app`).
- Emergency (no mail, password lost): in MongoDB, collection `adminauths`, document `admin`, remove the
  `passwordHash` field — the login falls back to `ADMIN_PASSWORD_HASH`.

## Scripts (from `backend/`)
- `GITHUB_TOKEN=$(gh auth token) npx tsx scripts/upsert-projects.ts --env .env [--only jeparla]` — featured projects with their AZ/EN texts.
- `npx tsx scripts/upsert-profile.ts --env .env` — profile (incl. experience) + CV PDFs from `backend/cv/`.
