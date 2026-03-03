// src/app/login/page.tsx
import { signIn, signOut, auth } from "@/auth"
import Image from "next/image"

export default async function LoginPage() {
    const session = await auth()

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            {session ? (
                <>
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                        {session.user?.image && (
                            <Image
                                src={session.user.image}
                                alt="Profile"
                                width={40}
                                height={40}
                                className="rounded-full"
                            />
                        )}
                        <div>
                            <p className="font-bold">{session.user?.name}</p>
                            <p className="text-sm text-gray-500">{session.user?.email}</p>
                        </div>
                    </div>

                    <form action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/login" })
                    }}>
                        <button className="px-4 py-2 bg-red-500 text-white rounded">
                            Sign out
                        </button>
                    </form>
                </>
            ) : (
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Welcome to QuickResume</h1>
                    <form action={async () => {
                        "use server";
                        await signIn("google", { redirectTo: "/dashboard" })
                    }}>
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                            Sign in with Google
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}