// src/app/(dashboard)/dashboard/profile/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation";
import { getUserProfile } from "@/app/actions/user-actions"
import { toPersonalInfo } from "@/lib/resume-mapper"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ProfileForm } from "@/components/ui/profile-form"

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const profile = await getUserProfile();
    const initial = toPersonalInfo(profile, session.user.name);

    return (
        <div className="min-h-screen flex flex-col bg-white text-black font-sans">
            <SiteHeader session={session} />
            <main className="flex-grow">
                <div className="max-w-[1280px] mx-auto p-6 md:p-12 space-y-12">
                    <div className="space-y-2 border-b border-black/5 pb-12">
                        <h1 className="text-4xl font-black tracking-tight text-gray-900 leading-none">Your Profile</h1>
                        <p className="text-lg text-black/40 font-bold">
                            Personal details that appear in the header of every resume you generate.
                        </p>
                    </div>
                    <ProfileForm
                        initial={initial}
                        account={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
                    />
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
