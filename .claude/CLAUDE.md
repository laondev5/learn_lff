# LFF LMS — Claude Code Rules

## Project Overview
A Learning Management System (LMS) built with **Next.js 15 App Router**, TypeScript, Tailwind CSS, shadcn/ui, MongoDB + Mongoose, NextAuth.js v5, Cloudinary (media storage), Pusher (realtime chat), Sonner (toasts), Zod + React Hook Form, and Nodemailer (email).

## Tech Stack
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: MongoDB + Mongoose ODM
- **Auth**: NextAuth.js v5 (Auth.js) with Mongoose/MongoDB adapter — email/password credentials provider
- **Realtime**: Pusher Channels (chat forums)
- **Storage**: Cloudinary — all image/file uploads (logo, signature, certificate assets, avatars)
- **Toasts**: Sonner — always use `sonner`, never any other toast library
- **Forms**: React Hook Form + Zod validation
- **Email**: Nodemailer (SMTP) — never use Resend
- **Icons**: Lucide React
- **PDF**: @react-pdf/renderer (certificate generation)

## User Roles
- **admin** — manages everything: creates users, uploads logo/signature, configures system
- **teacher** — creates courses, modules, lessons, tests, and exams
- **student** — views lessons sequentially, takes tests, participates in chat forums, earns certificates

## Routing Structure
```
/                          → redirect based on role
/auth/login                → login page (all roles)
/auth/forgot-password      → forgot password
/admin/...                 → admin dashboard & management
/teacher/...               → teacher dashboard
/student/...               → student dashboard & learning
```

## MongoDB Models (Mongoose)
- **User** — name, email, hashedPassword, role (admin|teacher|student), cohort, isActive, createdAt
- **Course** — title, description, teacher, modules[], isPublished
- **Module** — title, course, order, lessons[], isPublished
- **Lesson** — title, module, order, content (rich text), videoUrl, isPublished
- **Test** — lesson, questions[], passingScore, attempts
- **Question** — test, text, options[], correctAnswer, type (mcq|truefalse|shortAnswer)
- **Exam** — course, questions[], passingScore
- **StudentProgress** — student, course, completedLessons[], completedTests[], completedModules[], examPassed, certificateIssued
- **TestSubmission** — student, test, answers[], score, passed, attemptNumber
- **ExamSubmission** — student, exam, answers[], score, passed
- **ChatForum** — name, type (cohort|general), cohort (optional), members[]
- **Message** — forum, sender, content, createdAt
- **Certificate** — student, course, issuedAt, pdfUrl
- **SystemConfig** — logoUrl, signatureUrl, organizationName (singleton)

## UI Rules (STRICTLY ENFORCE)

### Component Library
- Always use **shadcn/ui** components first before writing custom UI
- Import from `@/components/ui/*` for shadcn components
- Use `cn()` from `@/lib/utils` for conditional classnames
- Never re-invent what shadcn already provides (Button, Input, Dialog, etc.)

### Responsiveness — MANDATORY
- Every page and component MUST be mobile-first responsive
- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Test at: mobile (375px), tablet (768px), desktop (1280px)
- Layouts: `flex-col` on mobile → `flex-row` or `grid` on `md:` and above
- Sidebars: collapsible Sheet/Drawer on mobile, fixed sidebar on `lg:` and above
- Tables: scroll horizontally on mobile with `overflow-x-auto`
- Cards: full-width on mobile, grid on desktop

### Color & Design System
- Use CSS variables from `globals.css` for all colors — never hardcode hex values
- Follow shadcn/ui theme tokens: `primary`, `secondary`, `muted`, `destructive`, `accent`, etc.
- Dark mode via `next-themes` — all components must support both light and dark modes
- Consistent border radius: `rounded-md` (cards/inputs), `rounded-full` (avatars/pills)
- Consistent spacing: Tailwind scale, prefer multiples of 4

### Typography
- H1: `text-2xl font-bold` | H2: `text-xl font-semibold` | H3: `text-lg font-medium`
- Body: `text-sm` or `text-base`; secondary: `text-muted-foreground`
- Never use raw `<b>` or `<i>` — use Tailwind font utilities instead

### Toasts (CRITICAL)
- **Always use Sonner** — zero exceptions
- Import: `import { toast } from "sonner"`
- Patterns:
  ```ts
  toast.success("Saved successfully")
  toast.error("Something went wrong")
  toast.loading("Please wait...")
  toast.promise(serverAction(), { loading: "Saving...", success: "Done!", error: "Failed" })
  ```
- `<Toaster richColors position="top-right" />` lives in the root layout only
- Never use `alert()`, `confirm()`, `react-hot-toast`, or any other notification library

### Forms
- All forms use **React Hook Form** + **Zod** resolver
- Schemas: `@/lib/validations/*.schema.ts`
- Use shadcn `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`
- Submit buttons show a `<Loader2 className="animate-spin" />` icon during loading
- Disable form during submission

### Loading & Error States
- `loading.tsx` in each route segment for Suspense
- `error.tsx` for error boundaries with retry button
- Content areas: use shadcn `<Skeleton />` — not spinners
- Auth redirect: full-page centered spinner acceptable

### Cloudinary Uploads
- All file/image uploads go to Cloudinary via a server-side API route `/api/upload`
- Use `cloudinary.uploader.upload()` server-side — never expose API secret to client
- Store only the returned `secure_url` and `public_id` in MongoDB
- Supported: images (logo, signature, avatar), PDFs

## Code Rules

### File Naming
- Pages: `page.tsx` (lowercase kebab-case directories)
- Components: `PascalCase.tsx`
- Utilities/helpers: `camelCase.ts`
- Schemas: `feature.schema.ts` in `@/lib/validations/`
- Server Actions: `feature.actions.ts` in `@/actions/`
- Mongoose models: `Feature.model.ts` in `@/models/`
- Types: `feature.types.ts` in `@/types/`

### Server vs Client Components
- Default to **Server Components** — add `"use client"` only when needed
- `"use client"` triggers: useState, useEffect, event handlers, browser APIs, Pusher client
- Server Actions in `@/actions/` — mark with `"use server"` directive
- Initial data fetching: async Server Components — avoid client-side fetch for page data

### Mongoose
- All models in `@/models/`
- Singleton pattern for db connection: `@/lib/mongoose.ts`
- Always call `await connectDB()` at the top of every Server Action and API route
- Use TypeScript interfaces for all document types
- Never use `.lean()` without defining the return type

### Auth (NextAuth v5)
- Config in `@/auth.ts`
- Session strategy: `jwt` with role stored in token
- Middleware in `middleware.ts` — protect routes by role
- `getServerSession()` / `auth()` for server-side session access
- Never trust client-supplied role — always verify server-side

### Security
- Role checks in `middleware.ts` — protect `/admin/*`, `/teacher/*`, `/student/*`
- Validate all inputs with Zod before DB operations
- Hash passwords with `bcryptjs` — never store plain text
- Never expose `MONGODB_URI`, `NEXTAUTH_SECRET`, `CLOUDINARY_API_SECRET`, `EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASSWORD
EMAIL_FROM` to client

### Environment Variables
```
MONGODB_URI
NEXTAUTH_SECRET
NEXTAUTH_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASSWORD
EMAIL_FROM
PUSHER_APP_ID
PUSHER_KEY
PUSHER_SECRET
PUSHER_CLUSTER
NEXT_PUBLIC_PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER
```

### Imports Order
1. React / Next.js
2. Third-party packages
3. Internal `@/` imports (models, actions, components, utils)
- Always use `@/` alias — never relative `../../` paths

## Business Logic Rules

### Sequential Learning (ENFORCE STRICTLY)
- Student cannot access Lesson N+1 unless Lesson N is marked complete
- Lesson is complete when: content viewed + all lesson tests passed with passing score
- Student cannot access Module N+1 unless all lessons in Module N are complete
- Exam unlocks only after ALL modules are fully complete
- Progress tracked in `StudentProgress` model — checked server-side before serving content

### Chat Forum
- Types: `cohort` (e.g., "April 2026 Cohort") and `general`
- Students see: their own cohort forum + general forum
- Teachers/admins see: all forums
- Realtime via **Pusher Channels** — subscribe client-side, trigger server-side via API route
- All messages persisted to MongoDB `Message` collection
- Paginated with infinite scroll (oldest at top, load more on scroll up)
- Show sender name, avatar initials, timestamp

### Certificate
- Issued only after: all modules complete + exam passed
- Admin uploads logo + signature in System Settings → stored in Cloudinary
- Certificate contains: student name, course name, completion date, LFF logo, admin signature
- Generated with `@react-pdf/renderer` — downloadable PDF

## Do NOT
- Do not use `pages/` directory — App Router only
- Do not use `getServerSideProps` or `getStaticProps`
- Do not write raw MongoDB queries — use Mongoose
- Do not use `localStorage` for auth state — use NextAuth session
- Do not use `any` TypeScript type
- Do not add unrequested features
- Do not hardcode secrets or credentials
- Do not skip Zod validation on any user input
- Do not use any toast library other than Sonner
- Do not use Supabase (not part of this stack)
- Do not use Prisma (using Mongoose instead)
