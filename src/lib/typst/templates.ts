// src/lib/typst/templates.ts
// Registry of Typst styling templates. Each entry points at a .typ file under
// public/typst/templates that exports `render(data)`. To add a template:
//   1. write public/typst/templates/<id>.typ exporting `#let render(data) = { ... }`
//   2. import it in public/typst/main.typ and add it to the `templates` dict there
//   3. add an entry here

export const TEMPLATES = {
    ledger: { label: "Ledger", file: "/typst/templates/ledger.typ" },
} as const;

export type TemplateId = keyof typeof TEMPLATES;

export const DEFAULT_TEMPLATE: TemplateId = "ledger";

export function isTemplateId(id: string): id is TemplateId {
    return Object.prototype.hasOwnProperty.call(TEMPLATES, id);
}
