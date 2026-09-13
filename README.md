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
