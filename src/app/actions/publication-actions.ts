"use server"

import { revalidatePath } from "next/cache"
import type { PublicationItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import {
    tagFieldsOf, deleteUserDoc, formBool, formStr, formStrOrNull, isoOf, readCol, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "publications";

export async function getPublications(): Promise<PublicationItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        title: strOf(d.title),
        venue: strOrNull(d.venue),
        date: isoOf(d.date),
        link: strOrNull(d.link),
        authors: strOrNull(d.authors),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updatePublication(publicationId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("title")) patch.title = formStr(formData, "title");
    if (formData.has("venue")) patch.venue = formStrOrNull(formData, "venue");
    if (formData.has("date")) patch.date = toTimestamp(formStr(formData, "date", 32));
    if (formData.has("link")) patch.link = formStrOrNull(formData, "link");
    if (formData.has("authors")) patch.authors = formStrOrNull(formData, "authors", LIMITS.long);
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, publicationId, patch);
    revalidatePath("/dashboard")
}

export async function deletePublication(publicationId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, publicationId);
    revalidatePath("/dashboard")
}
