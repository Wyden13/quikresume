# quikResume

Keep your whole professional history in one place, toggle what to include, and download a
clean, text-based PDF. Résumés are typeset with [Typst](https://typst.app) compiled directly in
the browser, so no server-side rendering and no rasterized output.

## Setup

```bash
npm install            # also copies the Typst wasm binaries into public/typst/wasm
cp .env.example .env.local   # then fill in Google OAuth + Firebase Admin credentials
npm run dev
```

Open http://localhost:3000, sign in with Google, and use the **Master Editor** to fill your
library. **Generate Resume** shows the live preview and the PDF download.

## Templates

Templates are plain Typst files in `public/typst/templates/`. Each exports `render(data)` and
receives the resume as JSON; see `CLAUDE.md` for the data contract and how to add one.
Iterate locally with the Typst CLI:

```bash
npm run typst:sample
```

See `CLAUDE.md` for architecture, data model, and conventions.

## Security

- **Rate limits.** Every API route is limited per user (Firestore-backed, so it holds across serverless
  instances) and every IP gets a burst limit in the proxy. Limits and the per-user daily AI budget
  (`AI_DAILY_TOKEN_BUDGET`, `AI_DAILY_CALL_BUDGET`) are documented in `CLAUDE.md` → Security.
- **Firestore.** The app only ever uses the Admin SDK, so `firestore.rules` denies all client access.
  Deploy it to both databases with `firebase deploy --only firestore:rules`, and enable a TTL policy on
  `expiresAt` for the `rate_limits` and `ai_usage` collection groups so counters expire:

  ```bash
  gcloud firestore fields ttls update expiresAt --collection-group=rate_limits --database=quikresume
  gcloud firestore fields ttls update expiresAt --collection-group=ai_usage --database=quikresume
  ```

- **AI input.** Uploaded résumés, pasted job postings and questionnaire answers are treated as data,
  never instructions: hidden Unicode is stripped, free text is fenced, every prompt carries an
  untrusted-content rule, and model output is cleaned before it is stored.
- **Headers.** A Content Security Policy, HSTS, `nosniff`, `X-Frame-Options: DENY` and a
  Permissions-Policy are set in `next.config.ts`; signed-in pages and API replies are `no-store`.

## License

Source-available, **not** open source. Copyright &copy; 2026 xuckless, all rights reserved.
You may read and inspect this code; you may not copy, run, host, modify, redistribute or
otherwise use it, and it may not be used as AI training data. See [LICENSE](LICENSE) for the
full terms, and contact [@xuckless](https://github.com/xuckless) for anything beyond reading.
