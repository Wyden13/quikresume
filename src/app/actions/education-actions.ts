"use server"

import { revalidatePath } from "next/cache"
import type { EducationItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import {
    tagFieldsOf, deleteUserDoc, formBool, formStr, formStrOrNull, isoOf, readCol, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "education";

// --- READ ---
export async function getEducations(): Promise<EducationItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "startDate", dir: "desc" }, (id, d) => ({
        id,
        schoolName: strOf(d.schoolName),
        locationCity: strOrNull(d.locationCity),
        locationProvince: strOrNull(d.locationProvince),
        locationCountry: strOrNull(d.locationCountry),
        programName: strOf(d.programName),
        minorName: strOrNull(d.minorName),
        doubleMajor: strOrNull(d.doubleMajor),
        gpa: strOrNull(d.gpa),
        details: strOrNull(d.details),
        startDate: isoOf(d.startDate),
        endDate: isoOf(d.endDate),
        isActive: Boolean(d.isActive),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateEducation(educationId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("schoolName")) patch.schoolName = formStr(formData, "schoolName");
    if (formData.has("programName")) patch.programName = formStr(formData, "programName");

    // Optional strings: empty -> null to keep the documents clean
    if (formData.has("locationCity")) patch.locationCity = formStrOrNull(formData, "locationCity");
    if (formData.has("locationProvince")) patch.locationProvince = formStrOrNull(formData, "locationProvince");
    if (formData.has("locationCountry")) patch.locationCountry = formStrOrNull(formData, "locationCountry");
    if (formData.has("minorName")) patch.minorName = formStrOrNull(formData, "minorName", LIMITS.field);
    if (formData.has("doubleMajor")) patch.doubleMajor = formStrOrNull(formData, "doubleMajor", LIMITS.field);
    if (formData.has("gpa")) patch.gpa = formStrOrNull(formData, "gpa", LIMITS.field);
    if (formData.has("details")) patch.details = formStrOrNull(formData, "details", LIMITS.long);

    if (formData.has("startDate")) {
        const ts = toTimestamp(formStr(formData, "startDate", 32));
        if (ts) patch.startDate = ts;
    }
    if (formData.has("endDate")) patch.endDate = toTimestamp(formStr(formData, "endDate", 32));
    if (formData.has("isActive")) patch.isActive = formBool(formData, "isActive");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, educationId, patch);
    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteEducation(educationId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, educationId);
    revalidatePath("/dashboard")
}
