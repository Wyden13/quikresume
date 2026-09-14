// src/lib/ui/fetch-json.ts
// Reads a route handler's JSON reply. A body that is not JSON (an HTML error page after a crash
// or a platform timeout) becomes `{ ok: false, error }` instead of "Unexpected token <".

export type JsonReply<T> = Partial<T> & { ok: boolean; error?: string };

export async function readJson<T extends object = Record<string, unknown>>(res: Response): Promise<JsonReply<T>> {
    try {
        const json = (await res.json()) as JsonReply<T>;
        if (json && typeof json === "object" && typeof json.ok === "boolean") return json;
        return { ok: res.ok, ...(json as object) } as JsonReply<T>;
    } catch {
        return { ok: false, error: `Server error (${res.status}). Try again.` } as JsonReply<T>;
    }
}
