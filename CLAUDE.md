# quikResume

Resume builder. Users keep their full professional history in a **Master Library**
(Firestore), toggle items on/off, and the app renders a tailored résumé with
**Typst compiled in the browser** (SVG preview, real text PDF download).

## Stack

- Next.js 16.1.6, App Router, Turbopack, React 19 + React Compiler (`reactCompiler: true`), TypeScript strict
- Tailwind CSS v4 (CSS-first: `@import "tailwindcss"` + `@theme` in `src/app/globals.css`; no tailwind.config)
- NextAuth v5 beta: Google provider, JWT sessions, `@auth/firebase-adapter`; `src/proxy.ts` (Next 16 name for middleware) guards `/dashboard/*`
- `firebase-admin` Firestore, **named database `"quikresume"`** (`src/lib/firestore.ts`)
- `@myriaddreamin/typst.ts` 0.7.0 (+ `typst-ts-web-compiler`, `typst-ts-renderer`), wraps Typst 0.13
- No test framework, no CI. Lint is `eslint-config-next` (core-web-vitals + typescript).

## Commands

```bash
npm install          # also runs postinstall: copies typst wasm into public/typst/wasm (gitignored)
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run typst:sample # compile public/typst/main.typ with sample.json (needs the `typst` CLI)
```

Iterate on a template with the CLI exactly as the browser sees it (only the vendored Inter fonts):

```bash
typst watch --root public/typst --font-path public/typst/fonts --ignore-system-fonts \
  public/typst/main.typ .typst-out/sample.pdf
# feed arbitrary JSON the way the app does
typst compile --root public/typst --font-path public/typst/fonts --ignore-system-fonts \
  --input resume="$(cat some.json)" --input template=ledger public/typst/main.typ .typst-out/out.pdf
```

Required env (`.env.local`): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escaped `\n` newlines are unescaped in code).

## Layout

```
src/
  auth.ts, proxy.ts, lib/firestore.ts        auth + db singletons
  app/page.tsx, (auth)/login, (dashboard)/dashboard/page.tsx
  app/actions/*-actions.ts                   "use server" CRUD per collection + resume-actions.ts (save)
  components/dashboard-client.tsx            view switch: library | edit | preview; draft state
  components/ui/resume-form.tsx              the Master Editor (controlled form)
  components/ui/selection-display.tsx        library cards (toggle / active / delete via server-action forms)
  components/ui/resume-preview.tsx           Typst preview + PDF download (client only)
  lib/dates.ts, lib/ids.ts                   date-string helpers, temp ids
  lib/resume-mapper.ts                       Firestore rows -> ResumeData (server)
  lib/typst/doc.ts                           ResumeData -> TypstResumeDoc (the JSON contract)
  lib/typst/client.ts                        browser singleton around typst.ts
  lib/typst/templates.ts                     template registry
  types/schema.ts                            editor model (ResumeData)
  types/db.ts                                serialized Firestore row types
public/typst/
  main.typ                                   entry: picks template, reads sys.inputs.resume
  templates/ledger.typ                       styling template exporting render(data)
  sample.json                                full sample doc for CLI iteration
  fonts/Inter-*.ttf (+ OFL.txt)              vendored fonts
  wasm/                                      gitignored, filled by scripts/copy-typst-wasm.mjs
```

## Data flow

1. `dashboard/page.tsx` (RSC) fetches profile + `experience`, `education`, `skills`, `projects`,
   `certifications` in parallel and builds `initialResumeData` with `toResumeData`.
2. `DashboardClient` holds `draft: ResumeData | null`. `resumeData = draft ?? initialResumeData`.
   Opening the editor copies server truth into the draft; Save calls `saveResumeData(draft)` then clears it;
   Discard just clears it. The draft is **never re-derived from props**, so `revalidatePath` refreshes
   after server actions cannot clobber unsaved edits.
3. `ResumeForm` edits through a functional `onChange(prev => next)`. New items get `tmp-<uuid>` ids
   (`src/lib/ids.ts`). Deleting a persisted item calls the delete action immediately; adds/edits persist on save.
4. `saveResumeData` writes personal info to `users/{uid}` and every list item into its subcollection
   (`isTempId` -> new doc, else merge by id), chunked under Firestore's 500-writes-per-batch limit.
5. Library cards call `update*`/`delete*` actions via `<form action>`; each action revalidates `/dashboard`.

## Typst pipeline

```
ResumeData --toTypstDoc()--> TypstResumeDoc (JSON) --sys.inputs.resume--> main.typ --> templates/<id>.typ render(data)
```

- `toTypstDoc` (`src/lib/typst/doc.ts`) is the **only** place data is shaped for Typst: it filters
  `isSelected`, formats date ranges, splits bullets, and guarantees every field is a string or array
  (never null). Templates are pure styling: they do no filtering or date logic and never receive markup.
  User text is displayed as plain strings, so `# * _ $ [ \` etc. need no escaping.
- `src/lib/typst/client.ts` lazily inits typst.ts once (wasm via URL from `/typst/wasm`, default remote
  font assets disabled, Inter preloaded, `main.typ` + templates registered with `addSource`), and
  serializes all compiles through one promise chain (the wasm is single-threaded).
  `compileSvg` -> preview, `compilePdf` -> download. Browser only: `ResumePreview` is loaded with
  `next/dynamic({ ssr: false })`.
- `ResumePreview` keys its effect on `JSON.stringify(doc)` and debounces 300 ms; it keeps the last good
  SVG visible while recompiling and shows Typst diagnostics on error.
- **Adding a template:** write `public/typst/templates/<id>.typ` exporting `#let render(data) = { ... }`;
  import it in `public/typst/main.typ` and add it to the `templates` dict; add an entry to
  `TEMPLATES` in `src/lib/typst/templates.ts`. Section macros in `ledger.typ`
  (`header`, `summary`, `education`, `skills`, `projects`, `experience`, `certifications`) are the
  reference for what each section receives.

`TypstResumeDoc` fields:

| key | shape |
|---|---|
| `header` | `{ name, tagline, location, phone, email, github, linkedin, website }` |
| `summary` | string |
| `education[]` | `{ title, institution, date, gpa, minor, details }` |
| `skills[]` | `{ label, value }` |
| `projects[]` | `{ title, stack, date, link, bullets[] }` |
| `experience[]` | `{ title, company, date, bullets[] }` |
| `certifications[]` | `{ name, issuer, year }` |

## Data model (Firestore)

`users/{uid}`: `firstName, lastName, headline, professionalEmail, phoneNumber, location, github, linkedIn,
website, bio, updatedAt` (+ NextAuth adapter fields such as `email`, `image`).

Subcollections, each doc has `isSelected`, `createdAt`, `updatedAt`:

| collection | fields |
|---|---|
| `experience` | `position, company, startDate, endDate, isActive, description: string[]` |
| `education` | `schoolName, programName, startDate, endDate, isActive, gpa, minorName, details, locationCity?, locationProvince?, locationCountry?, doubleMajor?` |
| `skills` | `category, items` |
| `projects` | `title, stack, link, startDate, endDate, isActive, description: string[]` |
| `certifications` | `name, issuer, year` |

Dates are stored as Firestore `Timestamp` at **UTC midnight** (`toUtcDate`). In the editor model
`startDate` is `"YYYY-MM-DD" | ""` and `endDate` is `"YYYY-MM-DD" | "Present" | ""`; `"Present"`
round-trips to `isActive: true` / `endDate: null`. `description` is newline-separated bullets in the
editor and `string[]` in Firestore.

## Conventions

- `"use server"` modules export only async functions and `export type` re-exports; every action
  checks `session.user.id` and scopes reads/writes to that user.
- Parse dates by parts with `src/lib/dates.ts`; never `new Date("YYYY-MM-DD")` (UTC parse shifts the
  month in negative-offset time zones).
- No `setState` from props inside effects; key effects on primitive strings; no manual `useMemo`/`useCallback`
  (React Compiler handles it).
- Optional strings are stored as `null`, not `""`. Mappers default missing fields to `""`.
- UI is light-only; no `dark:` variants.

## Gotchas

- Firestore `orderBy(field)` silently drops documents missing that field. `experience`/`education`
  order by `startDate`; `projects`/`certifications` order by `createdAt`. Always write the ordered field.
- Batch writes are capped at 500; `saveResumeData` chunks at 450.
- The compiler wasm is ~27 MB (~7 MB over the wire). It loads only when the preview mounts.
  `public/typst/wasm` is gitignored; if it is missing, run `npm install` (postinstall) or the copy script.
- Typst 0.13: use `json(bytes(str))`, not the removed `json.decode`. Inter has no CJK/emoji glyphs; enable
  `TypstSnippet.preloadFontAssets({ assets: ["cjk"] })` in `client.ts` if that is ever needed.
- `sys.inputs` values are strings; `main.typ` falls back to `sample.json` only when no `resume` input is given.
- `next/dynamic({ ssr: false })` is only allowed inside Client Components (as done in `dashboard-client.tsx`).
