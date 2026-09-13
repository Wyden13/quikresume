"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { toUtcDate } from "@/lib/dates";
import type { ProjectItem } from "@/types/db";


interface UpdateProjectData {
    title?: string;
    stack?: string | null;
    link?: string | null;
    description?: string[];
    startDate?: Timestamp | null;
    endDate?: Timestamp | null;
    isActive?: boolean;
    isSelected?: boolean;
    updatedAt: Timestamp;
}

const toTimestamp = (s: string | null) => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

// --- READ ---
export async function getProjects(): Promise<ProjectItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("projects")
        .orderBy("createdAt", "desc")
        .get()

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title ?? "",
            stack: data.stack ?? null,
            link: data.link ?? null,
            startDate: data.startDate?.toDate().toISOString() ?? null,
            endDate: data.endDate?.toDate().toISOString() ?? null,
            isActive: Boolean(data.isActive),
            description: Array.isArray(data.description) ? data.description : [],
            isSelected: Boolean(data.isSelected),
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
        };
    });
}

// --- UPDATE (partial) ---
export async function updateProject(projectId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: UpdateProjectData = { updatedAt: Timestamp.now() }

    if (formData.has("title")) updateData.title = formData.get("title") as string;
    if (formData.has("stack")) updateData.stack = (formData.get("stack") as string) || null;
    if (formData.has("link")) updateData.link = (formData.get("link") as string) || null;
    if (formData.has("description")) {
        updateData.description = ((formData.get("description") as string) || "")
            .split("\n").filter(line => line.trim() !== "");
    }
    if (formData.has("startDate")) updateData.startDate = toTimestamp(formData.get("startDate") as string);
    if (formData.has("endDate")) updateData.endDate = toTimestamp(formData.get("endDate") as string);
    if (formData.has("isActive")) {
        updateData.isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
    }
    if (formData.has("isSelected")) {
        updateData.isSelected = formData.get("isSelected") === "on" || formData.get("isSelected") === "true";
    }

    if (Object.keys(updateData).length > 1) {
        await db
            .collection("users")
            .doc(session.user.id)
            .collection("projects")
            .doc(projectId)
            .update({ ...updateData })
    }

    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteProject(projectId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("projects")
        .doc(projectId)
        .delete()

    revalidatePath("/dashboard")
}
