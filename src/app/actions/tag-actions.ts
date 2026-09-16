"use server"

import { currentUid } from "@/lib/db/session";
import { readTagAliases } from "@/lib/db/meta";
import type { AliasMap } from "@/lib/tags/normalize";

export async function getTagAliases(): Promise<AliasMap> {
    const uid = await currentUid();
    if (!uid) return {}
    return readTagAliases(uid);
}
