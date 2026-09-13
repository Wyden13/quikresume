"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import type { PublicationItem } from "@/types/db";
import {
    deleteUserDoc, formBool, formStrOrNull, isoOf, readCol, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "publications";

export async function getPublications(): Promise<PublicationItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    return readCol(session.user.id, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        title: strOf(d.title),
        venue: strOrNull(d.venue),
        date: isoOf(d.date),
        link: strOrNull(d.link),
        authors: strOrNull(d.authors),
        isSelected: Boolean(d.isSelected),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updatePublication(publicationId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const patch: Record<string, unknown> = {};
    if (formData.has("title")) patch.title = formData.get("title") as string;
    if (formData.has("venue")) patch.venue = formStrOrNull(formData, "venue");
    if (formData.has("date")) patch.date = toTimestamp(formData.get("date") as string);
    if (formData.has("link")) patch.link = formStrOrNull(formData, "link");
    if (formData.has("authors")) patch.authors = formStrOrNull(formData, "authors");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(session.user.id, COL, publicationId, patch);
    revalidatePath("/dashboard")
}

export async function deletePublication(publicationId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await deleteUserDoc(session.user.id, COL, publicationId);
    revalidatePath("/dashboard")
}
