"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import type { VolunteeringItem } from "@/types/db";
import {
    tagFieldsOf, deleteUserDoc, formBool, isoOf, readCol, strArray, strOf, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "volunteering";

export async function getVolunteering(): Promise<VolunteeringItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    return readCol(session.user.id, COL, { field: "startDate", dir: "desc" }, (id, d) => ({
        id,
        role: strOf(d.role),
        organization: strOf(d.organization),
        startDate: isoOf(d.startDate),
        endDate: isoOf(d.endDate),
        isActive: Boolean(d.isActive),
        description: strArray(d.description),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updateVolunteering(volunteeringId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const patch: Record<string, unknown> = {};
    if (formData.has("role")) patch.role = formData.get("role") as string;
    if (formData.has("organization")) patch.organization = formData.get("organization") as string;
    if (formData.has("description")) {
        patch.description = ((formData.get("description") as string) || "")
            .split("\n").filter(line => line.trim() !== "");
    }
    if (formData.has("startDate")) {
        const ts = toTimestamp(formData.get("startDate") as string);
        if (ts) patch.startDate = ts;
    }
    if (formData.has("endDate")) patch.endDate = toTimestamp(formData.get("endDate") as string);
    if (formData.has("isActive")) patch.isActive = formBool(formData, "isActive");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(session.user.id, COL, volunteeringId, patch);
    revalidatePath("/dashboard")
}

export async function deleteVolunteering(volunteeringId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await deleteUserDoc(session.user.id, COL, volunteeringId);
    revalidatePath("/dashboard")
}
