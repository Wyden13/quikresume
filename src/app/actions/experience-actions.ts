"use server"

import { revalidatePath } from "next/cache"
import type { ExperienceItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import {
    tagFieldsOf, deleteUserDoc, formBool, formBullets, formStr, formStrArray, isoOf, readCol, strArray, strOf, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "experience";

// --- READ ---
export async function getExperiences(): Promise<ExperienceItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "startDate", dir: "desc" }, (id, d) => ({
        id,
        position: strOf(d.position),
        company: strOf(d.company),
        isActive: Boolean(d.isActive),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        startDate: isoOf(d.startDate),
        endDate: isoOf(d.endDate),
        description: strArray(d.description),
        hidden: strArray(d.hidden),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateExperience(experienceId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("position")) patch.position = formStr(formData, "position");
    if (formData.has("company")) patch.company = formStr(formData, "company");
    if (formData.has("description")) patch.description = formBullets(formData, "description");
    if (formData.has("startDate")) {
        const ts = toTimestamp(formStr(formData, "startDate", 32));
        if (ts) patch.startDate = ts;
    }
    if (formData.has("endDate")) patch.endDate = toTimestamp(formStr(formData, "endDate", 32));
    if (formData.has("isActive")) patch.isActive = formBool(formData, "isActive");
    if (formData.has("hidden")) patch.hidden = formStrArray(formData, "hidden");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, experienceId, patch);
    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteExperience(experienceId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, experienceId);
    revalidatePath("/dashboard")
}
