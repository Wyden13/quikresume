"use server"

import { auth } from "@/auth"
import { readTagAliases } from "@/lib/db/meta";
import type { AliasMap } from "@/lib/tags/normalize";

export async function getTagAliases(): Promise<AliasMap> {
    const session = await auth()
    if (!session?.user?.id) return {}
    return readTagAliases(session.user.id);
}
