// scripts/copy-typst-wasm.mjs
// Copies the typst.ts compiler and renderer wasm binaries into public/typst/wasm
// so the browser can fetch them by URL (no bundler wasm handling needed).
// Runs on `npm install` via the postinstall script. Output dir is gitignored.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "public", "typst", "wasm");
const sources = [
    join(root, "node_modules", "@myriaddreamin", "typst-ts-web-compiler", "pkg", "typst_ts_web_compiler_bg.wasm"),
    join(root, "node_modules", "@myriaddreamin", "typst-ts-renderer", "pkg", "typst_ts_renderer_bg.wasm"),
];

mkdirSync(outDir, { recursive: true });

for (const src of sources) {
    const name = src.split(/[\\/]/).pop();
    if (!existsSync(src)) {
        console.warn(`[typst] missing ${src} - run npm install first`);
        continue;
    }
    const dest = join(outDir, name);
    copyFileSync(src, dest);
    const mb = (statSync(dest).size / 1024 / 1024).toFixed(1);
    console.log(`[typst] copied ${name} (${mb} MB) -> public/typst/wasm/`);
}
