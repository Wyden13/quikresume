// src/lib/db/session.ts
// The signed-in user's id, resolved once per request. The dashboard page calls a dozen server
// actions in parallel and each used to decode the session cookie again; React's `cache` makes
// them share one `auth()` call inside a render or action.

import "server-only";
import { cache } from "react";
import { auth } from "@/auth";

export const currentUid = cache(async (): Promise<string | null> => {
    const session = await auth();
    return session?.user?.id ?? null;
});

/** For mutations: throws when nobody is signed in. */
export async function requireUid(): Promise<string> {
    const uid = await currentUid();
    if (!uid) throw new Error("Unauthorized");
    return uid;
}
