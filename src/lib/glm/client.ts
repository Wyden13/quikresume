// src/lib/glm/client.ts
// Minimal server-side client for Z.ai's OpenAI-compatible chat completions API
// (GLM models). Only what resume import needs: one non-streaming call with
// text and image parts.
//
// Verified against the live API (Sep 2026): `glm-4.6v` accepts `text` and
// `image_url` parts (URL or data URI, <= 5 MB each). `file` parts are rejected
// by every model, so documents are rendered to images or reduced to text before
// they get here. `response_format: json_object` is text-model only, so JSON is
// extracted from the reply text (see src/lib/import/parsed-resume.ts).
// glm-5.x models reject `thinking: disabled` ("please use low, high, or max");
// they take `reasoning_effort` instead, which `effort` maps to.

import "server-only";
import type { Effort } from "./effort";

export type GlmContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

export interface GlmMessage {
    role: "system" | "user" | "assistant";
    content: string | GlmContentPart[];
}

export interface GlmOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** GLM "deep thinking"; off by default for latency. Ignored when `effort` is set. */
    thinking?: boolean;
    /**
     * Reasoning effort for models that cannot switch thinking off (glm-5.x):
     * sends `reasoning_effort` instead of `thinking`. "low" is fast enough for
     * JSON extraction jobs (~7 s for 20 items on glm-5.3-flash).
     */
    effort?: Effort;
    /** Ask for `response_format: json_object` (text models only; vision models reject it). */
    json?: boolean;
    timeoutMs?: number;
    /** Retries on 429/5xx/network errors (default 1). */
    retries?: number;
}

export interface GlmResult {
    text: string;
    model: string;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        /** Reasoning tokens are part of `completion_tokens` (and of the `max_tokens` budget). */
        completion_tokens_details?: { reasoning_tokens?: number };
    };
    finishReason: string | null;
    elapsedMs: number;
}

export class GlmError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = "GlmError";
    }
}

/** Vision model: reads resume / job-posting images. */
export const GLM_DEFAULT_MODEL = "glm-4.6v";
/** Text model: tag extraction, job-description analysis, proposals (JSON mode). */
export const GLM_DEFAULT_TEXT_MODEL = "glm-5.3-flash";
const DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";

export function glmModel(): string {
    return process.env.GLM_MODEL?.trim() || GLM_DEFAULT_MODEL;
}

export function textModel(): string {
    return process.env.GLM_TEXT_MODEL?.trim() || GLM_DEFAULT_TEXT_MODEL;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const retryable = (err: unknown) =>
    err instanceof GlmError && (err.status === undefined || err.status === 429 || err.status >= 500);

export function isGlmConfigured(): boolean {
    return Boolean(process.env.GLM_API_KEY?.trim());
}

export async function chatCompletion(messages: GlmMessage[], opts: GlmOptions = {}): Promise<GlmResult> {
    const retries = opts.retries ?? 1;
    for (let attempt = 0; ; attempt++) {
        try {
            return await chatCompletionOnce(messages, opts);
        } catch (err) {
            if (attempt >= retries || !retryable(err)) throw err;
            await sleep(1500 * (attempt + 1));
        }
    }
}

async function chatCompletionOnce(messages: GlmMessage[], opts: GlmOptions): Promise<GlmResult> {
    const apiKey = process.env.GLM_API_KEY?.trim();
    if (!apiKey) throw new GlmError("GLM_API_KEY is not configured on the server.");

    const baseUrl = (process.env.GLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const model = opts.model ?? glmModel();

    const started = Date.now();
    let res: Response;
    try {
        res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages,
                temperature: opts.temperature ?? 0.2,
                max_tokens: opts.maxTokens ?? 16384,
                ...(opts.effort
                    ? { reasoning_effort: opts.effort }
                    : { thinking: { type: opts.thinking ? "enabled" : "disabled" } }),
                ...(opts.json ? { response_format: { type: "json_object" } } : {}),
                stream: false,
            }),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        });
    } catch (err) {
        const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "could not be reached";
        throw new GlmError(`The GLM API ${reason}.`);
    }

    const bodyText = await res.text();
    if (!res.ok) {
        let detail = bodyText.slice(0, 300);
        try {
            const j = JSON.parse(bodyText) as { error?: { message?: string; code?: string } };
            if (j.error?.message) detail = `${j.error.code ? `[${j.error.code}] ` : ""}${j.error.message}`;
        } catch { /* keep raw snippet */ }
        throw new GlmError(`GLM API error ${res.status}: ${detail}`, res.status);
    }

    let json: { model?: string; choices?: Array<{ message?: { content?: string }; finish_reason?: string }>; usage?: GlmResult["usage"] };
    try {
        json = JSON.parse(bodyText);
    } catch {
        throw new GlmError("GLM API returned a non-JSON response.");
    }
    const elapsedMs = Date.now() - started;
    const finishReason = json.choices?.[0]?.finish_reason ?? null;
    if (opts.effort && opts.effort !== "low") {
        console.info(`[glm] ${model} effort=${opts.effort} ${elapsedMs}ms tokens=${json.usage?.completion_tokens ?? "?"} (reasoning ${json.usage?.completion_tokens_details?.reasoning_tokens ?? "?"}) finish=${finishReason}`);
    }
    // Reasoning tokens share the max_tokens budget: a long think can leave the JSON half written.
    if (finishReason === "length") throw new GlmError("The AI reply was cut off (token limit).");
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim() === "") throw new GlmError("GLM API returned an empty reply.");
    return { text, model: json.model ?? model, usage: json.usage, finishReason, elapsedMs };
}
