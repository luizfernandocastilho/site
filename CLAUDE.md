# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Personal website (portfolio) for Luiz Fernando Castilho (GitHub repo `site`, served at the custom
domain `www.luizcastilho.com`; local folder is `SISTEMA_SitePessoal`), built as a **static site with
[Astro](https://astro.build) 5** and managed with **GitHub Spec Kit** (Spec-Driven Development). The
site is bilingual (PT/EN) and **multi-page**: a home (professional presentation), plus
Certifications, Articles (PDF downloads), Resources, and Keynotes.

The repo also contains a **separate backend service** under `api/` — a Fastify + Postgres
"download-gate" API (see [The `api/` backend](#the-api-backend)). It is deployed independently (Docker
on a NAS), not part of the static build.

## Commands

Static site (repo root):

```bash
npm install        # install dependencies
npm run dev        # local dev server (http://localhost:4321)
npm run build      # static build → dist/
npm run preview    # serve the built dist/
npm run check      # astro check (types + content collection schemas)
npm test           # Vitest (run once); npm run test:watch for watch mode
npm run lint       # prettier --check .   (format gate)
npm run format     # prettier --write .
```

Run a single test file: `npx vitest run tests/unit/i18n.test.ts`.

Quality gate before committing: `npm run check && npm test && npm run lint`. CI (`.github/workflows/ci.yml`)
runs the same three gates, then a Lighthouse job that builds with `BASE_PATH=/` and enforces
Performance & Accessibility ≥ 95 (`lighthouserc.json`).

The `api/` service has its own package/tooling — see its section below.

## Architecture (the big picture)

- **Content is data, separated from layout** (constitution Principle IV). All owner-maintained
  content lives in versioned **Astro content collections** under `src/content/`, with Zod schemas in
  `src/content.config.ts`: `profile` (single bilingual item), `certifications`, `articles`,
  `keynotes`, and `ui` (interface strings, one file per locale). `articles`/`keynotes` hold
  metadata; the actual PDFs live in `public/`. Adding an item means editing content
  only — never layout. Data access goes through `src/lib/content.ts` (typed getters that also apply
  the `order`-then-date/year sort).

- **One localized page per nav section.** `src/lib/nav.ts` is the single source of truth for the
  menu: `NAV_ITEMS` maps each section to a per-locale URL slug and a UI-string label key. For each
  section there's a `*Page.astro` component (e.g. `ResourcesPage.astro`) that loads its data and
  renders `BaseLayout`; the actual route files under `src/pages/{pt,en}/` are thin per-locale
  wrappers (`recursos.astro` → `<ResourcesPage locale="pt" />`). The home is `Home.astro` (renders
  `Hero`). `src/pages/index.astro` is a static redirect to `/pt`.

- **`BaseLayout.astro` is the shell.** Every page renders through it, passing a `navKey`; the layout
  builds the header nav from `NAV_ITEMS` and highlights the active item. This is why adding a section
  is: new collection + schema + getter + `*Page.astro` + route wrappers + a `NAV_ITEMS` entry + UI
  strings — no edits to existing pages.

- **i18n without runtime JS.** Astro i18n routing (`defaultLocale: pt`, `locales: [pt, en]`, see
  `astro.config.mjs`). Pure, tested helpers live in `src/lib/i18n.ts`; `t(strings, key, fallback)`
  resolves a UI string with fallback to the other locale then the key itself. Build-only i18n that
  needs `astro:i18n` (URL building, the language toggle) lives in `src/lib/nav.ts` and
  `LanguageToggle.astro`; `counterpartUrl` keeps the current page when toggling language.

- **Only non-trivial logic is unit-tested** (`tests/unit/`): `i18n.ts`. Static content and
  presentation are not unit-tested; the format/type gates cover the rest.

## Conventions & gotchas

- Public asset paths must be base-prefixed: use `withBase(path, import.meta.env.BASE_URL)` from
  `src/lib/paths.ts`. The site deploys to the custom domain `www.luizcastilho.com`, so `BASE_PATH` is
  `/`; keep using `withBase` so a future move back to a sub-path base stays a one-line change.
- External links (certificate verification, social) open in a new tab (`target="_blank"
rel="noopener noreferrer"`). Contact is links only (email/social) — no contact form.
- All owner-facing content and every UI-string key must exist in both PT and EN
  (`src/content/ui/pt.json` and `en.json`). Content schemas enforce bilingual fields (e.g.
  `title_pt`/`title_en`).
- **Downloads — gate por padrão (see epic #185):** a content item with a **`fileId`** is
  **gated** (email form → private file served by token from the `api/` backend); an item with a
  **`pdf`** (in `public/`) is an **open** direct download (the opt-out); `url` is an external
  link. There is no `gated` flag — the presence of `fileId` is what gates. Convention: the
  private binary on the NAS is named **`<fileId>.pdf`**, and `api/src/seed.ts` derives the file
  registry from `src/content/**` (no hardcoded list). Adding a gated download = create the JSON
  with `fileId` + drop `<fileId>.pdf` in the NAS `storage/` + `npm run seed` — full step-by-step
  (site + NAS) in [Publishing new downloads (playbook)](#publishing-new-downloads-playbook).
- Env vars (see `.env.example`): `SITE_URL`, `BASE_PATH` (read by `astro.config.mjs`);
  `PUBLIC_API_URL` (build-time, embedded via `import.meta.env.PUBLIC_API_URL`) is the download-gate
  API base used as the `action` of the request form (`DownloadGate.astro`);
  `PUBLIC_UMAMI_SRC` + `PUBLIC_UMAMI_WEBSITE_ID` enable analytics (see below).
- **Analytics (Umami, self-hosted):** privacy-first, cookieless visitor stats. `BaseLayout.astro`
  injects the `<script is:inline defer …>` snippet **only when both `PUBLIC_UMAMI_*` vars are set**,
  so `npm run dev`/preview and forks stay untracked. Pageviews cover section/route navigation
  automatically. Named events are declarative — plain `data-umami-event="…"` (+ `data-umami-event-*`
  data) attributes on existing elements, **no client JS**: `download-pdf`/`download-request`
  (PDF cards & gated CTAs), `external-link` (social/keynote links), `cert-verify`, `contact-email`,
  `lang-switch` (`LanguageToggle`), `nav` (`Header` section links). Event values carry no PII. The
  Umami service runs on the NAS (exposed via Tailscale Funnel) — infra versioned in `analytics/`
  (compose + runbook); the LGPD note lives in `PrivacyPage.astro` (no consent banner, as it is
  cookieless/anonymized).
- Deploy: pushing to `main` runs `.github/workflows/deploy.yml` (static build → GitHub Pages).
- Sample content under `src/content/*` (files prefixed `exemplo-`) and `public/` PDFs is placeholder —
  replace with real data.

## The `api/` backend

Independent service (`api/`, `name: site-download-api`) implementing the **email download-gate**: a
visitor submits name + email, receives a **tokenized link** by email, and only then downloads the
file. Each request is logged in **Postgres** (the lead list). The static site stays static and just
`POST`s a native form to `POST /downloads/request`.

- **Stack:** Fastify + Postgres (`pg`) + Nodemailer (SMTP), TypeScript run directly via `tsx` (no
  build step in prod). Source in `api/src/` (`server.ts`, `routes/{downloads,admin}.ts`, `db.ts`,
  `tokens.ts`, `mailer.ts`, `migrate.ts`, `seed.ts`).
- **Run locally:** from `api/`, `cp .env.example .env` then `docker compose up --build` (Postgres +
  API; migrations run on boot). `docker compose exec api npm run seed` registers files by **deriving
  the registry from the site content collections** (`src/content/**`, mounted read-only at
  `/app/site-content`) — every item with a `fileId` becomes `{ id, title, filename: <fileId>.pdf }`;
  it warns if a `<fileId>.pdf` is missing from `storage/`. Editing `src/seed.ts` needs
  `docker compose up -d --build` (the `src/` is baked into the image). Scripts: `npm run dev`
  (watch), `migrate`, `seed`, `test` (Vitest), `typecheck`.
- **Endpoints:** `GET /health`; `POST /downloads/request` (form body `file_id,name,email,consent,locale?`);
  `GET /downloads/:token` (validates token, serves the private file); `GET /admin/leads.csv` (CSV
  export, requires `Authorization: Bearer $ADMIN_TOKEN`).
- **Security:** 256-bit opaque tokens stored only as SHA-256 hashes; rate-limited public endpoint;
  files kept **outside** the site (served only via token); secrets (`APP_SECRET`, `ADMIN_TOKEN`,
  Postgres, SMTP) come from `.env`, never versioned. Empty `SMTP_HOST` = dev mode (link only logged).
  See `api/README.md` for the NAS deploy notes and email-deliverability (SPF/DKIM/DMARC) caveats.

## Publishing new downloads (playbook)

End-to-end recipe for adding a new file to a section (articles, keynotes, livros, relatorios). A
**gated** download (`fileId`) has two halves: the **static site** (JSON + cover, versioned, published
by the GitHub Pages deploy) and the **NAS backend** (the private `<fileId>.pdf` + a `seed` run). Both
must be done — the site shows the card, but the download only works once the backend registers it.
An **open** download (`pdf` in `public/`) is site-only — no NAS step.

### 1. Site side (in the repo)

1. **Pick the `fileId`** — a short unique slug (e.g. `pendulo-ba`). It is the public URL slug and the
   storage filename; it is **independent of the source PDF's filename**.
2. **Create the JSON** in `src/content/<collection>/<fileId>.json` with `fileId` (gated) — plus
   bilingual `title`/`title_*` and `description_*`, a `cover`, and an `order`. For a whole series,
   keep `order` contiguous and alphabetical (renumber siblings in the same PR if needed — cheap while
   the PR is open).
3. **Cover** (decks: relatorios/livros/articles): `.webp` at **849×1200**, dropped in
   `public/relatorios/<fileId>.webp`. The house style renders it **from the PDF's first page** (the
   PDF cover already carries the site branding):
   ```bash
   pdftoppm -f 1 -l 1 -r 200 -png "REPORT.pdf" /tmp/cov          # → /tmp/cov-1.png
   magick /tmp/cov-1.png -resize 849x1200^ -gravity center -extent 849x1200 /tmp/cov.png
   cwebp -q 82 /tmp/cov.png -o public/relatorios/<fileId>.webp
   ```
   Gotcha: `pdftoppm` pads the page number to the page count's width — a 10+‑page PDF emits
   `cov-01.png`, not `cov-1.png`. Adjust the `magick` input accordingly.
4. **Gate:** `npm run check && npm test && npm run lint`, then **open an issue → branch → PR** (repo
   convention; `Closes #N`). Merging to `main` triggers `deploy.yml` (GitHub Pages) — the cards go
   live in ~1 min.

### 2. NAS side (gated only — makes the download actually work)

The backend `seed` derives its file registry from the site content **mounted read-only** into the
container (`../src/content`), so the NAS repo must hold the new JSON before seeding — i.e. **merge the
PR first, then `git pull` on the NAS, then `npm run seed`**. Seeding stale content silently registers
only the old files. Two things to get right:

1. The private binary in the NAS `storage/` must be named **exactly `<fileId>.pdf`** (it can be
   copied any time, even before the merge).
2. `seed` prints `N arquivo(s) registrado(s)` where **N = count of `fileId` items in
   `src/content/**`** (the `.json.example` sample is not loaded), and warns for any missing
   `<fileId>.pdf`. Then smoke-test the form on the live page and confirm the tokenized email arrives.

> The concrete connection details — SSH host/user, NAS repo & storage paths, the `sudo`/`docker`
> invocation, the `scp -O` quirk, and copy-paste commands — live in **`CLAUDE.local.md`** (gitignored,
> kept out of this public repo). Read it before doing a NAS deploy.

## Spec-Driven Development

Feature specs live in `specs/NNN-.../` (see `specs/001-homepage-portfolio/` for spec, plan, research,
data-model, contracts, tasks). Development is driven by `speckit-*` skills invoked as `/speckit.*`
slash commands: `constitution → specify → clarify → plan → tasks → analyze → implement`. The project
constitution is `.specify/memory/constitution.md` (v1.0.0) — its four principles (simplicity/YAGNI,
performance & accessibility, code quality & tests, content as versioned data) govern all changes. Do
not edit files under `.specify/templates/` or `.specify/scripts/` to customize behavior — use the
override/preset/extension layers.

## Workflow

Per repo convention, **open a GitHub issue before implementing any change**, get it approved, then
reference it with `Closes #N`.
