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
- Resume import: Z.ai GLM-4.6V (vision) via plain `fetch` (`src/lib/glm/client.ts`), `pdfjs-dist` (browser PDF
  rasterising), `mammoth` (DOCX text), `zod` (lenient output parsing)
- Smart tags + Job Match: Z.ai text model `glm-5.3-flash` in JSON mode (same client); `recharts` for the charts
- No test framework, no CI. Lint is `eslint-config-next` (core-web-vitals + typescript).

## Commands

```bash
npm install          # also runs postinstall: copies typst wasm into public/typst/wasm and the pdf.js
                     # worker into public/pdfjs (both gitignored)
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
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escaped `\n` newlines are unescaped in code),
`GLM_API_KEY` (import, tags, Job Match). Optional: `GLM_BASE_URL` (default `https://api.z.ai/api/paas/v4`),
`GLM_MODEL` (vision, default `glm-4.6v`), `GLM_TEXT_MODEL` (tags / JD analysis / proposals, default `glm-5.3-flash`).

## Layout

```
src/
  auth.ts, proxy.ts, lib/firestore.ts        auth + db singletons
  app/page.tsx, (auth)/login, (dashboard)/dashboard/{page,profile/page,variants/page}.tsx
  app/api/import/route.ts                    POST upload -> GLM-4.6V -> ResumeData draft (see Resume import)
  app/api/tags/{analyze,backfill}/route.ts   tag unsaved draft items (nothing persisted) / re-tag stale library items
  app/api/jobs/{analyze,proposals,reconcile}/route.ts   JD -> requirements (+ reconcile when the form carries `resume`) /
                                             gap -> proposals (re-reconciles first) / re-run the reconcile pass for a saved job
  app/actions/*-actions.ts                   "use server" CRUD per collection + resume-actions.ts (save + tagging)
                                             + user-actions.ts (profile), variant-actions.ts, job-actions.ts, tag-actions.ts
  lib/db/{user-collection,meta,variants,jobs,load-resume}.ts   server-only Firestore helpers
  components/site-header.tsx, site-footer.tsx, nav-link.tsx   signed-in chrome (Dashboard / Variants / Profile)
  components/dashboard-client.tsx            view switch: library | edit | preview | import | insights | jobs; draft state
  components/ui/resume-form.tsx              the Master Editor (controlled form; "Used in N variants" / "Not analysed" badges)
  components/ui/form-controls.tsx            Label / Input / Textarea / Button shared by the forms
  components/ui/confirm-dialog.tsx           modal confirm (discard, delete, save-affects-variants)
  components/ui/profile-form.tsx             Profile page form -> updateUserProfile
  components/ui/resume-import.tsx            multi-file upload (PDF -> page images) + combined review step
  components/ui/selection-display.tsx        library cards (toggle / active / delete via server-action forms; tag chips)
  components/ui/variant-toolbar.tsx          Save as / Load / Update variant on the library view
  components/ui/variants-page.tsx            /dashboard/variants: search, labels, rename, duplicate, delete, load
  components/ui/insights-view.tsx, tag-charts.tsx   tag charts (recharts radar / bars / treemap) + tag table
  components/ui/job-match-view.tsx, proposal-cards.tsx, job-context-panel.tsx, use-page-count.ts   Job Match
  components/ui/resume-preview.tsx           Typst preview + PDF download (client only)
  lib/dates.ts, lib/ids.ts, lib/hash.ts      date-string helpers, temp ids, stableHash (content hashes)
  lib/sections.ts                            ResumeListKey <-> Firestore collection names, item labels
  lib/resume-mapper.ts                       Firestore rows -> ResumeData (server); personalInfoToUserDoc
  lib/glm/client.ts                          chatCompletion() for Z.ai (server-only): vision + text models, JSON mode
  lib/import/{prompt,dates,parsed-resume,merge,types}.ts   import prompt, date normaliser, zod parser, union merge
  lib/import/pdf-pages.ts (browser), document-text.ts (server)   upload -> GLM parts, shared with /api/jobs/analyze
  lib/tags/{types,content,normalize,prompt,extract,aggregate}.ts   smart tags (see Smart tags)
  lib/variants.ts                            pure variant helpers (selectedIds, applyVariant, variantUsage)
  lib/match/{types,text,score,coverage,recommend,proposals,prompt,resume-body}.ts   Job Match scoring, coverage, set cover, proposals (pure)
  lib/match/reconcile.ts                     server-only "broader context" pass: LLM reconciles requirements vs the whole library
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
public/pdfjs/pdf.worker.min.mjs              gitignored, filled by scripts/copy-pdfjs-worker.mjs
```

## Data flow

1. `dashboard/page.tsx` (RSC) fetches profile + `experience`, `education`, `skills`, `projects`,
   `certifications`, `awards`, `volunteering`, `publications`, `languages` in parallel and builds
   `initialResumeData` with `toResumeData`.
2. `DashboardClient` holds `draft: ResumeData | null`. `resumeData = draft ?? initialResumeData`.
   Opening the editor copies server truth into the draft; Save calls `saveResumeData(draft)` then clears it;
   Discard just clears it. The draft is **never re-derived from props**, so `revalidatePath` refreshes
   after server actions cannot clobber unsaved edits.
3. `ResumeForm` edits through a functional `onChange(prev => next)`. New items get `tmp-<uuid>` ids
   (`src/lib/ids.ts`). Deleting a persisted item calls the delete action immediately; adds/edits persist on save.
4. `saveResumeData` writes personal info to `users/{uid}` and every list item into its subcollection
   (`isTempId` -> new doc, else merge by id), chunked under Firestore's 500-writes-per-batch limit.
5. Library cards call `update*`/`delete*` actions via `<form action>`; each action revalidates `/dashboard`.
6. The Profile page (`/dashboard/profile`) edits the same `users/{uid}` fields through `updateUserProfile`;
   both it and `saveResumeData` go through `personalInfoToUserDoc` so the written shape stays identical.
7. `isSelected` is the **working selection**. A variant (`/dashboard/variants`) is a snapshot of the selected
   ids; loading one rewrites `isSelected` on every item. Editing an item used by variants shows a badge and a
   confirm dialog on Save & Exit (variants are pointers, so the edit shows up in all of them).

## Smart tags

Every item (all 9 collections) and the profile headline+bio carry `tags: {name, display, kind}[]`,
kind ∈ `technical-skill | tool-platform | domain | soft-skill | methodology | credential | language`.
Weight of a tag = number of selected items carrying it (`aggregateTags`, computed on read).

- **Hash rule** (`lib/tags/content.ts`): `contentHash` is taken over the content fields only (no dates / ids /
  isSelected). An item is *stale* when `tagsHash !== contentHash`. Changing the field list re-stales everything once.
- **Extraction** (`lib/tags/extract.ts`, `saveResumeData`): stale items go to the text model in chunks of 20,
  3 chunks in parallel, 60 s budget, JSON mode. Every chunk also carries `tagContext(data)` (headline, degrees,
  summary; not hashed) so the model can file items under the candidate's field, and the prompt asks for
  *implied* concepts ("5-service architecture" -> Microservices, a compiler project -> Computer Science as domain)
  while tools/platforms must still be named. Degrees yield the specific degree **and** the generic level
  ("Bachelor's Degree"). Libraries tagged before this rule keep their old tags until re-tagged (Insights ->
  Analyse everything, or `POST /api/tags/backfill {force:true}`). A failure never blocks the save: items stay stale and the
  action returns `tagWarning`. `POST /api/tags/analyze` tags draft items without persisting (live Job Match,
  uploaded resumes); `POST /api/tags/backfill` re-tags stale (or all) persisted items.
- **Normalisation** (`lib/tags/normalize.ts`): lowercase key + built-in alias table (`js` -> `javascript`,
  `k8s` -> `kubernetes`, …) + model-reported aliases stored in `users/{uid}/meta/tags` (accepted only when the
  canonical is a returned tag name; built-ins never overridden). `display` keeps the pretty spelling.
- Profile tags live on `ResumeData.profileTags` (not inside `PersonalInfo`, which is treated as a flat string map).
- `glm-5.x` models reject `thinking: disabled`; the client sends `reasoning_effort` when `effort` is set
  (`"low"` ≈ 7 s per 20-item chunk on `glm-5.3-flash`).

## Job Match

- `POST /api/jobs/analyze`: pasted text or an uploaded file (images transcribed with GLM-4.6V) -> text model ->
  `requirements: {name, display, kind, importance: must|nice, yearsMin}` saved in `users/{uid}/jobs`.
- **Reconcile pass** (`lib/match/reconcile.ts`, server-only): exact tag keys miss what a human sees at once, so the
  text model gets *all* requirements + the candidate's whole tag inventory + condensed items and returns, per
  requirement, `satisfiedBy` (other candidate tag keys that count: `bachelor's degree` <- `bachelor of science`,
  `microservices` <- `grpc`) and `evidence` (item ids that demonstrate it without a tag) + `reason`. These are
  stored **on the requirement** in the job doc, so the pure scorer honours them on every client-side recompute.
  Runs in `/api/jobs/analyze` when the form carries `resume` (the client sends the working selection), in
  `/api/jobs/proposals` before scoring, and on demand via `POST /api/jobs/reconcile {jobId, resume}`
  ("Re-check with AI" button; works for variants and uploads too). Failures never block: requirements come
  back unchanged and the built-in hierarchy still applies.
- **Coverage** (`lib/match/coverage.ts`, pure): an item covers a requirement when it carries the exact key, a
  `satisfiedBy` key, a key the built-in hierarchy accepts (`builtinSatisfiers` in `lib/tags/normalize.ts`:
  `bachelor's degree` <- any `bachelor of …` / master / doctorate, etc.), or is cited in `evidence`. Shared by
  the scorer and the set cover.
- **Scoring** (`lib/match/score.ts`, pure, runs in the browser for the live panel):
  `strength = covered ? min(1, 0.5 + 0.25·weight) : literalHit ? 0.5 : 0` (credentials / languages: any carrier = 1);
  `score = 100·Σ(w·strength)/Σw` with `w = importance (must 1, nice 0.4) × tier (hard 1, soft 0.3)`.
  **Tier** (`requirementTier`): `soft-skill`, `methodology`, `domain` kinds and a built-in list of generic practices
  (`PRACTICE_KEYS`: SDLC, documentation, software testing, code review, analytical thinking, …) are *soft*;
  named technologies, tools, credentials and languages are *hard*. `missingMust` = hard must-haves with no
  coverage (the disqualifiers, e.g. C++ with no coursework or project); `keywordGaps` = soft requirements with
  no coverage ("add these keywords before applying"). `MatchRow.via` / `.reason` explain inferred hits in the UI.
  `literalHit` searches the exact strings Typst prints (`renderedText(toTypstDoc(data))`) — the ATS check.
- **Recommendation** (`lib/match/recommend.ts`): greedy weighted set cover (must = 3, nice = 1, a requirement
  saturates after 2 carriers) under per-section caps (`DEFAULT_CAPS`, user-editable in `meta/preferences`);
  matching skill categories always in; education never excluded. Produces include/exclude proposals.
- `POST /api/jobs/proposals`: deterministic include/exclude + text-model `rewrite-bullet | add-skill | gap`
  proposals, muted rules filtered, statuses preserved by id, stored on the job. "Ignore similar" writes a
  `{kind, tag | itemId}` rule to `users/{uid}/meta/preferences.mutedProposals`.
- Apply: include/exclude call the item's `update*` action (or edit the draft when one is open); rewrite /
  add-skill always edit the draft (`applyProposal`) and open the editor. "Tailor for this job" keeps a sticky
  panel (`job-context-panel.tsx`) with the live score and page count on the Library / Editor views.

## Resume import

```
file --(browser)--> PDF? render pages to JPEG with pdf.js : send as-is
     --POST /api/import (multipart)--> DOCX -> mammoth text | TXT -> text | images -> image_url parts
     --> GLM-4.6V (SYSTEM_PROMPT in lib/import/prompt.ts) --> JSON text
     --> parseModelOutput (lib/import/parsed-resume.ts) --> { data: ResumeData (tmp ids), warnings }
     --> review step (resume-import.tsx) --> mergeImport into the editor draft --> user clicks Save & Exit
```

- Nothing is persisted by the import itself; the draft goes through the normal `saveResumeData` path.
- It is a Route Handler, not a server action: server actions cap bodies at 1 MB and the route needs
  `maxDuration = 120` (GLM calls take 10–60 s). It calls `auth()` itself (`proxy.ts` only guards `/dashboard`).
- **GLM facts (verified live):** `glm-4.6v` accepts `text` and `image_url` parts (URL or data URI, ≤ 5 MB each).
  `file` parts are rejected by every model, and `response_format: json_object` is text-model only, which is
  why PDFs are rasterised in the browser and JSON is extracted from the reply with a balanced-brace scan.
- Parsing is lenient on purpose: the envelope never fails, each item is validated on its own with zod, and
  rejects go into `warnings` (shown in the review step). Dates like `2021`, `Jan 2021`, `03/2021`,
  `Spring 2020`, `Present` are normalised in `lib/import/dates.ts`.
- `mergeImport` appends new items and **merges** duplicates (same `itemKey`): bullets and skill lists are
  unioned, empty scalar fields filled. The review step labels rows New / Adds detail / Already in library.
  Several files can be queued in one session (`combineParsedFiles` dedupes across files). Personal info fills
  only empty fields unless the user ticks "Replace my existing details".
- Prompt tuning lives in `lib/import/prompt.ts`; skill grouping (3–6 categories when the resume lists
  skills flat) and section routing (Awards/Volunteering/Publications/Languages) are instructed there.

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
| `volunteering[]` | `{ title, organization, date, bullets[] }` |
| `publications[]` | `{ title, venue, date, link, authors }` |
| `awards[]` | `{ title, issuer, date, description }` |
| `certifications[]` | `{ name, issuer, year }` |
| `languages[]` | `{ language, proficiency }` |

## Data model (Firestore)

`users/{uid}`: `firstName, lastName, headline, professionalEmail, phoneNumber, location, github, linkedIn,
website, bio, profileTags, profileContentHash, profileTagsHash, loadedVariantId, updatedAt`
(+ NextAuth adapter fields such as `email`, `image`).

Subcollections, each item doc has `isSelected`, `tags`, `contentHash`, `tagsHash`, `createdAt`, `updatedAt`:

| collection | fields |
|---|---|
| `experience` | `position, company, startDate, endDate, isActive, description: string[]` |
| `education` | `schoolName, programName, startDate, endDate, isActive, gpa, minorName, details, locationCity?, locationProvince?, locationCountry?, doubleMajor?` |
| `skills` | `category, items` |
| `projects` | `title, stack, link, startDate, endDate, isActive, description: string[]` |
| `certifications` | `name, issuer, year` |
| `awards` | `title, issuer, date, description` |
| `volunteering` | `role, organization, startDate, endDate, isActive, description: string[]` |
| `publications` | `title, venue, date, link, authors` |
| `languages` | `language, proficiency` |
| `variants` | `name, labels: string[], items: {experience: string[], …}, templateId` (pointers only) |
| `jobs` | `title, company, source, jdText, summary, requirements[] ({name, display, kind, importance, yearsMin, satisfiedBy[], evidence[], reason}), proposals[], proposalsAt, lastScore` |
| `meta/tags` | `aliases: Record<alias, canonical>` |
| `meta/preferences` | `mutedProposals: {kind, tag?, itemId?}[], caps: Record<ResumeListKey, number \| null>` |

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

- Firestore `orderBy(field)` silently drops documents missing that field. `experience`/`education`/`volunteering`
  order by `startDate`; `projects`/`certifications`/`awards`/`publications`/`languages` order by `createdAt`.
  Always write the ordered field.
- Batch writes are capped at 500; `saveResumeData` chunks at 450.
- The compiler wasm is ~27 MB (~7 MB over the wire). It loads only when the preview mounts.
  `public/typst/wasm` is gitignored; if it is missing, run `npm install` (postinstall) or the copy script.
- Typst 0.13: use `json(bytes(str))`, not the removed `json.decode`. Inter has no CJK/emoji glyphs; enable
  `TypstSnippet.preloadFontAssets({ assets: ["cjk"] })` in `client.ts` if that is ever needed.
- `sys.inputs` values are strings; `main.typ` falls back to `sample.json` only when no `resume` input is given.
- `next/dynamic({ ssr: false })` is only allowed inside Client Components (as done in `dashboard-client.tsx`).
- `"use server"` files may only export async functions, so shared Firestore boilerplate lives in
  `src/lib/db/user-collection.ts` (plain `server-only` module); never build actions with a factory.
- Route handler files may only export route fields (`GET`, `POST`, `runtime`, `maxDuration`, …); shared
  constants/types for `/api/import` live in `src/lib/import/types.ts`.
- `dashboard/page.tsx` exports `maxDuration = 120` because Save & Exit (a server action) now calls GLM; actions
  inherit their page's segment config. Long GLM calls otherwise live in route handlers.
- `variants` and `jobs` order by `updatedAt` (always written).
- ESLint ignores `public/pdfjs/**` and `public/typst/wasm/**` (vendored bundles).
- No `typst` CLI locally: `pip install typst` in a venv gives `typst.compile(...)` with `sys_inputs`, which is
  enough to check the templates against `sample.json`.
