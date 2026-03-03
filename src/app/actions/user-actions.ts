// src/app/actions/user-actions.ts

"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateProfile(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const data = {
        firstName: formData.get("firstName") as string,
        middleName: formData.get("middleName") as string,
        lastName: formData.get("lastName") as string,
        linkedIn: formData.get("linkedIn") as string,
        phoneNumber: formData.get("phoneNumber") as string,
        location: formData.get("location") as string,
        bio: formData.get("bio") as string,
        overview: formData.get("overview") as string,
        availability: formData.get("availability") as string,
        // Ensure we don't overwrite the email since it's permanent
        updatedAt: new Date(),
    }

    await db.collection("users").doc(session.user.id).set(data, { merge: true })

    revalidatePath("/dashboard")
    redirect("/dashboard") // Send them home after saving
}