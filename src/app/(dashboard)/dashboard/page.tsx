// src/app/dashboard/page.tsx
import { auth } from "@/auth"

export default async function DashboardPage() {
    const session = await auth();

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold">Welcome back, {session?.user?.name}!</h1>
            <p className="text-gray-600">Start building your resume below.</p>
        </div>
    )
}