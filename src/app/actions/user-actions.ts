"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { PersonalInfo } from "@/types/schema"

export async function getUserProfile() {
    const session = await auth()
    if (!session?.user?.id) return null

    const userDoc = await db.collection("users").doc(session.user.id).get()
    if (!userDoc.exists) return null

    return {
        id: userDoc.id,
        ...userDoc.data()
    } as PersonalInfo & { id: string };
}

export async function updateProfile(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    // Required fields
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string

    if (!firstName || !lastName) {
        throw new Error("First and Last name are required.")
    }

    const data = {
        firstName: firstName,
        lastName: lastName,
        // Optional fields: if empty string, save as null
        middleName: (formData.get("middleName") as string) || null,
        professionalEmail: (formData.get("professionalEmail") as string) || null,
        linkedIn: (formData.get("linkedIn") as string) || null,
        phoneNumber: (formData.get("phoneNumber") as string) || null,
        location: (formData.get("location") as string) || null,
        bio: (formData.get("bio") as string) || null,
        overview: (formData.get("overview") as string) || null,
        availability: (formData.get("availability") as string) || null,
        updatedAt: new Date(),
    }

    await db.collection("users").doc(session.user.id).set(data, { merge: true })

    revalidatePath("/dashboard")
    redirect("/dashboard")
}