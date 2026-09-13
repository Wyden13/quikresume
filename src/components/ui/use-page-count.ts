// src/components/ui/use-page-count.ts
"use client";

// Compiles the resume in the background (debounced) and reports how many A4
// pages it renders to. Mount only where the number is shown: the first call
// loads the Typst wasm.

import { useEffect, useState } from "react";
import type { ResumeData } from "@/types/schema";
import { toTypstDoc, type TypstResumeDoc } from "@/lib/typst/doc";
import { compileSvg, ensureTypst } from "@/lib/typst/client";

const DEBOUNCE_MS = 600;

export function useResumePageCount(data: ResumeData): number | null {
    const docJson = JSON.stringify(toTypstDoc(data));
    const [pages, setPages] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                await ensureTypst();
                const result = await compileSvg(JSON.parse(docJson) as TypstResumeDoc);
                if (!cancelled) setPages(result.pageCount);
            } catch {
                if (!cancelled) setPages(null);
            }
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [docJson]);

    return pages;
}
