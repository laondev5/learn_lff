# LFF LMS Project

## Architecture
- **Framework**: Next.js 16 (App Router)
- **Database**: MongoDB (Mongoose)
- **Auth**: NextAuth.js 5 (Beta)
- **UI**: Tailwind CSS, Shadcn UI
- **Storage**: Cloudinary (Videos/Images)
- **Email**: Nodemailer/Resend
- **External APIs**: Google Calendar (for Live Classes)

## Recent Tasks & Features
### 1. Accountability Partner
- **Description**: Add accountability partner fields (name, email, location) to student profile.
- **Workflow**:
  - Admin adds partner during student creation.
  - Welcome email sent to partner.
  - Track student progress; notify partner if student is stuck for > X hours (default 72h).
  - Admin can configure "stuck" duration in system settings.

### 2. Live Class & Exams (Google Meet Integration)
- **Goal**: Enable instructors to schedule live classes with automatic Google Meet link generation.
- **Workflow**:
  - Instructor OAuth 2.0 with Google.
  - Create calendar event with `conferenceData`.
  - Store meeting details in DB.
  - Students join via dashboard.

## Development Guidelines
- Use Server Actions for data mutations (`src/actions/`).
- Use Mongoose models in `src/models/`.
- Component structure: `src/components/[admin|student|teacher|shared|ui]`.
- Types in `src/types/` or co-located with models.
- Verification: Always test email flows and OAuth redirects locally before PR.

## Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run linting
- `npx ts-node scripts/seed-admin.ts`: Seed initial admin user
