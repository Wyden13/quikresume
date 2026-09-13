// src/app/(dashboard)/dashboard/variants/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLoadedVariantId, getVariants } from "@/app/actions/variant-actions";
import { loadResumeData } from "@/lib/db/load-resume";
import { VariantsPage } from "@/components/ui/variants-page";

export default async function VariantsRoute() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const [variants, loadedVariantId, data] = await Promise.all([
        getVariants(),
        getLoadedVariantId(),
        loadResumeData(session.user.id, session.user.name),
    ]);

    return <VariantsPage variants={variants} loadedVariantId={loadedVariantId} data={data} />;
}
