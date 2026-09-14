"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { FieldValue } from "firebase-admin/firestore";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { SECTION_COLLECTION } from "@/lib/sections";
import type { ReviewTarget } from "@/lib/review/types";

/** Hides one coach suggestion for good (it stays hidden until the item is reviewed again). */
export async function dismissReviewSuggestion(target: ReviewTarget, id: string, suggestionId: string): Promise<void> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    if (typeof suggestionId !== "string" || !suggestionId) return;
    const userRef = db.collection("users").doc(session.user.id);
    try {
        if (target === "profile") {
            await userRef.update({ "profileReview.dismissed": FieldValue.arrayUnion(suggestionId) });
        } else if (RESUME_LIST_KEYS.includes(target) && typeof id === "string" && id && !id.includes("/")) {
            await userRef.collection(SECTION_COLLECTION[target]).doc(id).update({ "review.dismissed": FieldValue.arrayUnion(suggestionId) });
        }
    } catch (err) {
        // The item was deleted meanwhile: nothing to hide.
        if ((err as { code?: number }).code !== 5) throw err;
    }
    revalidatePath("/dashboard")
    if (target === "profile") revalidatePath("/dashboard/profile")
}
