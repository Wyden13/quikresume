"use server"

import { revalidatePath } from "next/cache"
import type { VolunteeringItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import {
    tagFieldsOf, deleteUserDoc, formBool, formBullets, formStr, formStrArray, isoOf, readCol, strArray, strOf, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "volunteering";

export async function getVolunteering(): Promise<VolunteeringItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "startDate", dir: "desc" }, (id, d) => ({
        id,
        role: strOf(d.role),
        organization: strOf(d.organization),
        startDate: isoOf(d.startDate),
        endDate: isoOf(d.endDate),
        isActive: Boolean(d.isActive),
        description: strArray(d.description),
        hidden: strArray(d.hidden),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updateVolunteering(volunteeringId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("role")) patch.role = formStr(formData, "role");
    if (formData.has("organization")) patch.organization = formStr(formData, "organization");
    if (formData.has("description")) patch.description = formBullets(formData, "description");
    if (formData.has("startDate")) {
        const ts = toTimestamp(formStr(formData, "startDate", 32));
        if (ts) patch.startDate = ts;
    }
    if (formData.has("endDate")) patch.endDate = toTimestamp(formStr(formData, "endDate", 32));
    if (formData.has("isActive")) patch.isActive = formBool(formData, "isActive");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");
    if (formData.has("hidden")) patch.hidden = formStrArray(formData, "hidden");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, volunteeringId, patch);
    revalidatePath("/dashboard")
}

export async function deleteVolunteering(volunteeringId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, volunteeringId);
    revalidatePath("/dashboard")
}
