// Signed-in shell: sidebar + content column. Pages render their own <TopBar>.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth-actions";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    return (
        <AppShell
            user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
            signOutAction={signOutAction}
        >
            {children}
        </AppShell>
    );
}
