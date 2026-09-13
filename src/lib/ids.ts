// src/lib/ids.ts
// Items created in the editor get a temporary id until saveResumeData assigns
// a Firestore document id. Both the client and the server use this one check.

export const TEMP_ID_PREFIX = "tmp-";

export function newTempId(): string {
    const uuid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${TEMP_ID_PREFIX}${uuid}`;
}

export function isTempId(id: string): boolean {
    return id.startsWith(TEMP_ID_PREFIX);
}
