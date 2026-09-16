"use server"

import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { FieldValue } from "firebase-admin/firestore";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { SECTION_COLLECTION } from "@/lib/sections";
import { userDoc } from "@/lib/db/user-collection";
import { requireUid } from "@/lib/db/session";
import { isDocId } from "@/lib/validation/limits";
import type { ReviewTarget } from "@/lib/review/types";

/** Hides one coach suggestion for good (it stays hidden until the item is reviewed again). */
export async function dismissReviewSuggestion(target: ReviewTarget, id: string, suggestionId: string): Promise<void> {
    const uid = await requireUid();
    // Suggestion ids are stableHash outputs (16 hex chars); anything else is not ours.
    if (typeof suggestionId !== "string" || !/^[a-f0-9]{1,32}$/.test(suggestionId)) return;
    const userRef = db.collection("users").doc(uid);
    try {
        if (target === "profile") {
            await userRef.update({ "profileReview.dismissed": FieldValue.arrayUnion(suggestionId) });
        } else if (RESUME_LIST_KEYS.includes(target) && isDocId(id)) {
            await userDoc(uid, SECTION_COLLECTION[target], id).update({ "review.dismissed": FieldValue.arrayUnion(suggestionId) });
        }
    } catch (err) {
        // The item was deleted meanwhile: nothing to hide.
        if ((err as { code?: number }).code !== 5) throw err;
    }
    revalidatePath("/dashboard")
    if (target === "profile") revalidatePath("/dashboard/profile")
}
