# Project Context & Architecture Documentation

## Project Overview

* **Name:** QuikResume (derived from database/project naming)
* **Goal:** A professional resume builder application that allows users to input their complete professional and academic history into a "Master Library," and dynamically generate tailored resumes by toggling specific components on or off.

## Tech Stack

* **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
* **Language:** TypeScript
* **Authentication:** NextAuth v5 (Auth.js) using Google Provider (JWT Strategy)
* **Database:** Firebase / Google Cloud Firestore (NoSQL) via `firebase-admin`
* **Styling:** Tailwind CSS

---

## Database Architecture (Firestore NoSQL)

The database utilizes a nested hierarchical structure to relate data to specific users without requiring traditional SQL normalization or complex joins.

* **`users` (Top-Level Collection):** Managed partially by NextAuth and populated with custom profile data.
* **`experience` (Subcollection):** Stores individual job records linked to the user.
* **`education` (Subcollection):** Stores individual academic records linked to the user.



---

## Features & Server Actions Implemented

### 1. Authentication & Database Connection (`src/auth.ts`, `src/lib/firestore.ts`)

* **Custom Firestore Adapter:** Bypassed the default NextAuth Firestore initialization to explicitly target the `quikresume` database ID, resolving gRPC `5 NOT_FOUND` routing errors.
* **Session ID Injection:** Configured NextAuth callbacks to explicitly attach the user ID (`token.sub`) to the session object for secure server-side verification.

### 2. User Profile Management (`src/app/actions/user-actions.ts`)

* **Features:** Update Profile, Delete Account.
* **Data Handled:** First Name, Last Name (Required). Middle Name, Professional Email, LinkedIn, Phone, Location, Bio, Overview, Availability (Optional).
* **Logic:** Supports true partial updates using `formData.has()`. Prevents database pollution by converting empty strings to `null`.

### 3. Experience Management (`src/app/actions/experience-actions.ts`)

* **Features:** Create, Update (Partial), Delete.
* **Data Handled:** Position, Company, Start Date (Required). End Date (Nullable for "Present"), Description (Array of strings).
* **Toggles:** * `isActive`: Boolean to mark a role as current/featured.
* `isSelected`: Boolean to include/exclude the role in the generated resume.


* **Logic:** Safely parses HTML date strings into Firestore `Timestamp` objects. Filters out empty bullet points from descriptions.

### 4. Education Management (`src/app/actions/education-actions.ts`)

* **Features:** Create, Update (Partial), Delete.
* **Data Handled:** School Name, Location City, Program Name, Start Date (Required). End Date (Nullable), Province, Country, Minor, Double Major, GPA (Optional).
* **Toggles:** `isActive`, `isSelected`.
* **Logic:** Implements strict TypeScript interfaces (`UpdateEducationData`) to eliminate ESLint `any` errors and safely handle optional metadata.

---

## Key Engineering Standards Applied

1. **Bulletproof Null Handling:** All optional form fields use a `|| null` or ternary fallback to ensure empty HTML inputs (`""`) are stored as clean `null` values, preventing UI rendering errors.
2. **Safe Date Parsing:** Validates date strings before passing them to `Timestamp.fromDate()` to prevent server crashes. Handles "Present" logic by passing `null` when no end date is provided.
3. **True Partial Updates:** Update actions instantiate an empty object and conditionally append properties only if they exist in the `FormData` payload. This allows the frontend to send isolated updates (e.g., just toggling a checkbox) without overwriting surrounding data.
4. **Action Isolation:** Database mutations are securely restricted to the server using the `"use server"` directive and require an active session ID to execute.

## Pending/Next Steps

* **Frontend UI Integration:** Mapping over the fetched subcollections to render the Experience and Education lists with attached Edit/Delete/Toggle UI components.
* **Resume Assembly Engine:** Querying the database for items specifically marked `isSelected: true` to generate the final output.
* **PDF Generation:** Implementing the visual layout and export logic for the final resume.