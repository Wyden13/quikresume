export { auth as proxy } from "@/auth"

export const config = {
    // This regex protects everything inside the (dashboard) group
    // and any other path starting with /dashboard
    matcher: ["/dashboard/:path*"],
}