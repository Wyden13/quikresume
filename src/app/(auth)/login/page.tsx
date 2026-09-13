// src/app/(auth)/login/page.tsx
import { signIn, signOut, auth } from "@/auth"
import Image from "next/image"
import Link from "next/link"

export default async function LoginPage() {
    const session = await auth()

    return (
        <div className="min-h-screen bg-white text-black font-sans flex flex-col">
            {/* Header */}
            <header className="flex flex-row justify-between items-center px-6 py-6 md:px-16 md:py-6 w-full max-w-[1280px] mx-auto">
                <Link href="/" className="flex flex-row items-center gap-2">
                    <Image src="/icons/quik-resume.svg" alt="quikResume Logo" width={40} height={40} className="w-7 h-7 md:w-10 md:h-10" priority />
                    <span className="font-semibold text-lg md:text-2xl tracking-tight">quikResume</span>
                </Link>
                <div className="flex flex-row items-center gap-6">
                    {session ? (
                        <Link href="/dashboard" className="flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-base hover:bg-black/80 transition-colors">
                            Dashboard
                        </Link>
                    ) : (
                        <Link href="/" className="font-medium text-base hover:text-black/70 transition-colors">
                            Back to Home
                        </Link>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6 bg-gray-50/30">
                <div className="w-full max-w-md bg-white border border-black/10 rounded-2xl p-8 shadow-sm">
                    {session ? (
                        <div className="flex flex-col items-center gap-6 text-center">
                            <h1 className="text-2xl font-bold tracking-tight">Already Signed In</h1>
                            <div className="flex flex-col items-center gap-3 p-6 border border-black/5 rounded-xl w-full bg-black/5">
                                {session.user?.image && (
                                    <Image
                                        src={session.user.image}
                                        alt="Profile"
                                        width={64}
                                        height={64}
                                        className="rounded-full border-2 border-white shadow-sm"
                                    />
                                )}
                                <div>
                                    <p className="font-bold text-lg">{session.user?.name}</p>
                                    <p className="text-sm text-black/55">{session.user?.email}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 w-full">
                                <Link href="/dashboard" className="w-full flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-base hover:bg-black/80 transition-colors">
                                    Go to Dashboard
                                </Link>
                                <form action={async () => {
                                    "use server";
                                    await signOut({ redirectTo: "/login" })
                                }} className="w-full">
                                    <button className="w-full px-4 py-3 border-2 border-black/15 text-black rounded-xl font-medium text-base hover:bg-black/5 transition-colors">
                                        Sign out
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-8 text-center">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-3xl font-bold tracking-tight">Welcome!</h1>
                                <p className="text-black/55 font-medium text-lg">Sign in to continue to quikResume</p>
                            </div>
                            
                            <form action={async () => {
                                "use server";
                                await signIn("google", { redirectTo: "/dashboard" })
                            }} className="w-full">
                                <button className="w-full flex justify-center items-center gap-3 px-6 py-4 bg-black text-white rounded-xl font-medium text-lg hover:bg-black/80 transition-all active:scale-[0.98]">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continue with Google
                                </button>
                            </form>

                            <p className="text-xs text-black/40 px-4 leading-relaxed">
                                By signing in, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 text-center text-sm text-black/40 border-t border-black/5">
                &copy; {new Date().getFullYear()} quikResume. All rights reserved.
            </footer>
        </div>
    )
}
