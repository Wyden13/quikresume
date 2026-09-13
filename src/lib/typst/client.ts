// src/lib/typst/client.ts
// Browser-only singleton around @myriaddreamin/typst.ts. Never import this
// from a Server Component: the wasm packages only run in the browser. All
// typst imports are dynamic so an accidental server evaluation stays inert.
//
// Assets (all served from /public):
//   /typst/wasm/*.wasm        copied from node_modules by scripts/copy-typst-wasm.mjs
//   /typst/fonts/Inter-*.ttf  vendored (OFL); default remote font assets are disabled
//   /typst/main.typ           entry point (template registry + sys.inputs plumbing)
//   /typst/templates/*.typ    styling templates exporting render(data)

import type { TypstResumeDoc } from "@/lib/typst/doc";
import { DEFAULT_TEMPLATE, TEMPLATES, type TemplateId } from "@/lib/typst/templates";

type Snippet = typeof import("@myriaddreamin/typst.ts/contrib/snippet");
type TypstInstance = Snippet["$typst"];

export type TypstStage = "idle" | "loading" | "ready" | "failed";

const WASM_COMPILER = "/typst/wasm/typst_ts_web_compiler_bg.wasm";
const WASM_RENDERER = "/typst/wasm/typst_ts_renderer_bg.wasm";
const MAIN_FILE = "/main.typ";
const FONT_URLS = [
    "/typst/fonts/Inter-Regular.ttf",
    "/typst/fonts/Inter-Italic.ttf",
    "/typst/fonts/Inter-Medium.ttf",
    "/typst/fonts/Inter-SemiBold.ttf",
    "/typst/fonts/Inter-Bold.ttf",
];

let stage: TypstStage = "idle";
let instancePromise: Promise<TypstInstance> | null = null;
// The wasm compiler is single-threaded and shares shadow-file state, so all
// compiles are serialized through this chain.
let queue: Promise<unknown> = Promise.resolve();

export function getTypstStage(): TypstStage {
    return stage;
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    return res.text();
}

async function init(): Promise<TypstInstance> {
    if (typeof window === "undefined") {
        throw new Error("Typst can only be initialized in the browser");
    }
    const { $typst, TypstSnippet } = await import("@myriaddreamin/typst.ts/contrib/snippet");

    $typst.setCompilerInitOptions({ getModule: () => WASM_COMPILER });
    $typst.setRendererInitOptions({ getModule: () => WASM_RENDERER });
    // Providers must be registered before the first compile.
    $typst.use(TypstSnippet.disableDefaultFontAssets(), TypstSnippet.preloadFonts(FONT_URLS));

    const templateIds = Object.keys(TEMPLATES) as TemplateId[];
    const [main, ...templateSources] = await Promise.all([
        fetchText("/typst/main.typ"),
        ...templateIds.map(id => fetchText(TEMPLATES[id].file)),
    ]);

    await $typst.addSource(MAIN_FILE, main);
    await Promise.all(templateIds.map((id, i) => $typst.addSource(`/templates/${id}.typ`, templateSources[i])));

    return $typst;
}

/** Idempotent: loads wasm, fonts and template sources once. Re-armed on failure. */
export function ensureTypst(): Promise<TypstInstance> {
    if (!instancePromise) {
        stage = "loading";
        instancePromise = init().then(
            inst => {
                stage = "ready";
                return inst;
            },
            err => {
                stage = "failed";
                instancePromise = null;
                throw err;
            },
        );
    }
    return instancePromise;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work);
    queue = run.catch(() => undefined);
    return run;
}

function compileInputs(doc: TypstResumeDoc, template: TemplateId): Record<string, string> {
    return { resume: JSON.stringify(doc), template };
}

const A4_HEIGHT_PT = 841.89;

export function countSvgPages(svg: string): number {
    const marked = (svg.match(/class="typst-page"/g) ?? []).length;
    if (marked > 0) return marked;
    const h = /<svg[^>]*\sheight="([\d.]+)/.exec(svg);
    return h ? Math.max(1, Math.round(Number(h[1]) / A4_HEIGHT_PT)) : 1;
}

export interface SvgResult {
    svg: string;
    pageCount: number;
}

export function compileSvg(doc: TypstResumeDoc, template: TemplateId = DEFAULT_TEMPLATE): Promise<SvgResult> {
    return enqueue(async () => {
        const $typst = await ensureTypst();
        const svg = await $typst.svg({ mainFilePath: MAIN_FILE, inputs: compileInputs(doc, template) });
        if (!svg) throw new Error("Typst returned an empty document");
        return { svg, pageCount: countSvgPages(svg) };
    });
}

export function compilePdf(doc: TypstResumeDoc, template: TemplateId = DEFAULT_TEMPLATE): Promise<Uint8Array> {
    return enqueue(async () => {
        const $typst = await ensureTypst();
        const pdf = await $typst.pdf({ mainFilePath: MAIN_FILE, inputs: compileInputs(doc, template) });
        if (!pdf) throw new Error("Typst returned no PDF data");
        return pdf;
    });
}

// typst.ts 0.7 throws compile errors as a Rust debug string such as
// `[SourceDiagnostic { severity: Error, span: ..., message: "...", hints: [] }]`.
// Pull out the human-readable parts.
function prettifyDiagnostics(raw: string): string {
    const messages = [...raw.matchAll(/severity:\s*(\w+)[^{}]*?message:\s*"((?:[^"\\]|\\.)*)"/g)]
        .map(m => `${m[1].toLowerCase()}: ${m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n")}`);
    return messages.length > 0 ? messages.join("\n") : raw;
}

/** Turns whatever typst.ts throws (string, Error, diagnostics array/object) into readable text. */
export function formatTypstError(err: unknown): string {
    if (typeof err === "string") return prettifyDiagnostics(err);
    if (err instanceof Error) return err.message;
    if (Array.isArray(err)) return err.map(formatTypstError).join("\n");
    if (err && typeof err === "object") {
        const o = err as Record<string, unknown>;
        if (typeof o.message === "string") {
            const range = typeof o.range === "string" ? ` (${o.range})` : "";
            const path = typeof o.path === "string" ? `${o.path}: ` : "";
            return `${path}${o.message}${range}`;
        }
        if (Array.isArray(o.diagnostics)) return formatTypstError(o.diagnostics);
        try {
            return JSON.stringify(err, null, 2);
        } catch {
            /* fall through */
        }
    }
    return String(err);
}
