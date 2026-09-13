"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import type { UserProfile } from "@/types/db"

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export async function getUserProfile(): Promise<UserProfile | null> {
    const session = await auth()
    if (!session?.user?.id) return null

    const userDoc = await db.collection("users").doc(session.user.id).get()
    const data = userDoc.data();
    if (!userDoc.exists || !data) return null;

    // Pick fields explicitly: the user doc also holds NextAuth adapter fields
    // and Timestamps that must not cross the server -> client boundary.
    return {
        id: userDoc.id,
        firstName: str(data.firstName),
        lastName: str(data.lastName),
        headline: str(data.headline),
        email: str(data.email),
        professionalEmail: str(data.professionalEmail),
        phoneNumber: str(data.phoneNumber),
        location: str(data.location),
        github: str(data.github),
        linkedIn: str(data.linkedIn),
        website: str(data.website),
        bio: str(data.bio),
    };
}
