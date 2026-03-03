import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { db } from "@/lib/firestore"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: FirestoreAdapter(db),
    providers: [Google],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        // This callback injects the ID into the session object
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
})