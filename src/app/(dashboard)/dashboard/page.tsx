// src/app/(dashboard)/dashboard/page.tsx
import { auth } from "@/auth"
import { getExperiences } from "@/app/actions/experience-actions"
import { getEducations } from "@/app/actions/education-actions"
import DashboardClient from "@/components/dashboard-client"

export default async function DashboardPage() {
    const session = await auth();
    const experiences = await getExperiences();
    const educations = await getEducations();

    return (
        <DashboardClient 
            initialExperiences={experiences} 
            initialEducations={educations} 
            userName={session?.user?.name?.split(" ")[0] || "User"}
        />
    );
}
