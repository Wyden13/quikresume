import { auth, signIn } from "@/auth"
import { db } from "@/lib/firestore"
import { updateProfile } from "@/app/actions/user-actions"

export default async function TestPage() {
    const session = await auth()

    // Use a clean sign-in trigger instead of <a>
    if (!session?.user?.id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold text-red-600">Session Required</h1>
                <p className="text-gray-600">Please sign in to access your profile.</p>
                <form action={async () => { "use server"; await signIn("google") }}>
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">
                        Sign in with Google
                    </button>
                </form>
            </div>
        )
    }

    // Fetch existing Firestore data
    const userDoc = await db.collection("users").doc(session.user.id).get()
    const userData = userDoc.data()

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white shadow-lg rounded-2xl mt-12 border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Basic Information</h1>
            <p className="text-gray-500 mb-8">This data will be used as your default contact info.</p>

            <form action={updateProfile} className="space-y-6">
                {/* READ ONLY EMAIL */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-600">Primary Email</label>
                    <input
                        type="email"
                        disabled
                        value={session.user.email || ""}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-gray-600">First Name</label>
                        <input
                            name="firstName"
                            defaultValue={userData?.firstName || session.user.name?.split(" ")[0]}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-gray-600">Last Name</label>
                        <input
                            name="lastName"
                            defaultValue={userData?.lastName || session.user.name?.split(" ").slice(1).join(" ")}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-600">Phone Number</label>
                    <input
                        name="phoneNumber"
                        type="tel"
                        defaultValue={userData?.phoneNumber || ""}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="+1 (555) 000-0000"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-md active:scale-95"
                >
                    Save Profile
                </button>
            </form>
        </div>
    )
}