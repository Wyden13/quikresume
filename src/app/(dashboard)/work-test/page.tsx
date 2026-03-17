// import { auth, signIn } from "@/auth"
// import { createExperience, getExperiences, deleteExperience, updateExperience } from "@/app/actions/experience-actions"
//
// export default async function WorkTestPage() {
//     const session = await auth()
//
//     if (!session?.user?.id) {
//         return (
//             <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
//                 <h1 className="text-2xl font-bold text-red-600">Session Required</h1>
//                 <p className="text-gray-600">Please sign in to add work experience.</p>
//                 <form action={async () => { "use server"; await signIn("google") }}>
//                     <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">
//                         Sign in with Google
//                     </button>
//                 </form>
//             </div>
//         )
//     }
//
//     const experiences = await getExperiences()
//
//     return (
//         <div className="max-w-4xl mx-auto p-8 mt-12">
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
//                 {/* LEFT COLUMN: ADD FORM */}
//                 <div>
//                     <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100 sticky top-8">
//                         <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Work Experience</h1>
//                         <p className="text-gray-500 mb-8">Fill in the details of your professional role.</p>
//
//                         <form action={createExperience} className="space-y-6">
//                             <div className="grid grid-cols-1 gap-4">
//                                 <div className="flex flex-col gap-1">
//                                     <label className="text-sm font-semibold text-gray-600">Position</label>
//                                     <input
//                                         name="position"
//                                         placeholder="Software Engineer"
//                                         className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
//                                         required
//                                     />
//                                 </div>
//                                 <div className="flex flex-col gap-1">
//                                     <label className="text-sm font-semibold text-gray-600">Company</label>
//                                     <input
//                                         name="company"
//                                         placeholder="Google"
//                                         className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
//                                         required
//                                     />
//                                 </div>
//                             </div>
//
//                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                                 <div className="flex flex-col gap-1">
//                                     <label className="text-sm font-semibold text-gray-600">Start Date</label>
//                                     <input
//                                         name="startStr"
//                                         type="date"
//                                         className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
//                                         required
//                                     />
//                                 </div>
//                                 <div className="flex flex-col gap-1">
//                                     <label className="text-sm font-semibold text-gray-600">End Date</label>
//                                     <input
//                                         name="endStr"
//                                         type="date"
//                                         className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
//                                         placeholder="Leave blank if currently working here"
//                                     />
//                                 </div>
//                             </div>
//
//                             <div className="flex items-center gap-2">
//                                 <input
//                                     type="checkbox"
//                                     name="isActive"
//                                     id="isActive"
//                                     className="w-5 h-5 accent-blue-600"
//                                 />
//                                 <label htmlFor="isActive" className="text-sm font-semibold text-gray-600">
//                                     I currently work here
//                                 </label>
//                             </div>
//
//                             <div className="flex flex-col gap-1">
//                                 <label className="text-sm font-semibold text-gray-600">Description</label>
//                                 <textarea
//                                     name="description"
//                                     rows={5}
//                                     placeholder="Enter your responsibilities (one per line)..."
//                                     className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
//                                 />
//                             </div>
//
//                             <button
//                                 type="submit"
//                                 className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-md active:scale-95"
//                             >
//                                 Save Experience
//                             </button>
//                         </form>
//                     </div>
//                 </div>
//
//                 {/* RIGHT COLUMN: LIST */}
//                 <div className="space-y-6">
//                     <h2 className="text-2xl font-bold text-gray-900">Your Experience</h2>
//                     {experiences.length === 0 ? (
//                         <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl text-center">
//                             <p className="text-gray-500">No experience added yet. Use the form to get started.</p>
//                         </div>
//                     ) : (
//                         experiences.map((exp) => (
//                             <div key={exp.id} className="bg-white p-6 shadow-sm border border-gray-200 rounded-2xl hover:shadow-md transition-shadow">
//                                 <div className="flex justify-between items-start mb-4">
//                                     <div>
//                                         <h3 className="font-bold text-lg text-gray-900">{exp.position}</h3>
//                                         <p className="text-blue-600 font-medium">{exp.company}</p>
//                                         <p className="text-sm text-gray-500 mt-1">
//                                             {exp.startDate.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {exp.isActive ? 'Present' : exp.endDate?.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
//                                         </p>
//                                     </div>
//                                     <form action={deleteExperience.bind(null, exp.id)}>
//                                         <button className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
//                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
//                                                 <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
//                                             </svg>
//                                         </button>
//                                     </form>
//                                 </div>
//
//                                 {exp.description && exp.description.length > 0 && (
//                                     <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
//                                         {exp.description.map((line, i) => (
//                                             <li key={i}>{line}</li>
//                                         ))}
//                                     </ul>
//                                 )}
//
//                                 <div className="flex gap-4 border-t border-gray-100 pt-4">
//                                     <form action={updateExperience.bind(null, exp.id)} className="flex items-center gap-2">
//                                         <input type="hidden" name="isSelected" value={(!exp.isSelected).toString()} />
//                                         <button
//                                             type="submit"
//                                             className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${exp.isSelected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
//                                         >
//                                             {exp.isSelected ? '✓ Selected for Resume' : 'Show on Resume'}
//                                         </button>
//                                     </form>
//
//                                     <form action={updateExperience.bind(null, exp.id)} className="flex items-center gap-2">
//                                         <input type="hidden" name="isActive" value={(!exp.isActive).toString()} />
//                                         <button
//                                             type="submit"
//                                             className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${exp.isActive ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
//                                         >
//                                             {exp.isActive ? 'Current Role' : 'Set as Current'}
//                                         </button>
//                                     </form>
//                                 </div>
//                             </div>
//                         ))
//                     )}
//                 </div>
//             </div>
//         </div>
//     )
// }
