"use server"

import { revalidatePath } from "next/cache"
import type { ProjectItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import {
    tagFieldsOf, deleteUserDoc, formBool, formBullets, formStr, formStrArray, formStrOrNull, isoOf, readCol, strArray, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "projects";

// --- READ ---
export async function getProjects(): Promise<ProjectItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        title: strOf(d.title),
        stack: strOrNull(d.stack),
        link: strOrNull(d.link),
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

// --- UPDATE (partial) ---
export async function updateProject(projectId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("title")) patch.title = formStr(formData, "title");
    if (formData.has("stack")) patch.stack = formStrOrNull(formData, "stack", LIMITS.long);
    if (formData.has("link")) patch.link = formStrOrNull(formData, "link");
    if (formData.has("description")) patch.description = formBullets(formData, "description");
    if (formData.has("startDate")) patch.startDate = toTimestamp(formStr(formData, "startDate", 32));
    if (formData.has("endDate")) patch.endDate = toTimestamp(formStr(formData, "endDate", 32));
    if (formData.has("isActive")) patch.isActive = formBool(formData, "isActive");
    if (formData.has("hidden")) patch.hidden = formStrArray(formData, "hidden");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, projectId, patch);
    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteProject(projectId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, projectId);
    revalidatePath("/dashboard")
}
