import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Living Faith Foundation | Learning Portal",
  description:
    "Video lessons in the foundations of the faith, church life and ministry, with lesson notes, questions inside the video, exams and certificates.",
}

const includes = [
  {
    title: "Recorded teaching",
    body: "Each lesson is a video teaching of nine to twenty-five minutes. Lessons are grouped into modules, and the modules build one subject at a time.",
  },
  {
    title: "Lesson notes",
    body: "Every lesson carries written notes: the overview, the scriptures taken up, the outline, the terms used, and questions to think through. Read them beside the video or keep them.",
  },
  {
    title: "Questions inside the video",
    body: "Questions pause the teaching at the moment the point is made, so you answer while it is still fresh and then carry on from the same second.",
  },
  {
    title: "Exams and certificates",
    body: "A course closes with an exam. When you pass it, the certificate is issued to your account and stays there.",
  },
  {
    title: "Live classes",
    body: "Instructors schedule sessions on Google Meet. The time and the link appear in your class list, alongside the recorded work.",
  },
  {
    title: "Questions to the teacher",
    body: "Ask about anything in a course where the rest of your class can see it. The answer is kept with the course, so the next member finds it too.",
  },
]

const steps = [
  {
    title: "Sign in",
    body: "Use the credentials issued to you by your assembly. If you have lost your password, reset it from the sign-in page.",
  },
  {
    title: "Open a course",
    body: "Your enrolled courses are on the dashboard, and the lesson you stopped at is the one the portal opens.",
  },
  {
    title: "Work through the lessons",
    body: "Watch, read the notes, and answer the questions that appear in the video. Progress is saved as you go.",
  },
  {
    title: "Sit the exam",
    body: "When the modules are complete the exam opens, and your certificate follows the pass.",
  },
]

const roles = [
  {
    title: "For members",
    body: "Study at your own pace on any device, in order or straight to the subject you need. Announcements from your teachers and your cohort reach you in the same place.",
  },
  {
    title: "For teachers",
    body: "Build a course from modules and lessons, attach the notes, place the questions at the right second of a video, schedule the live class and mark what comes back.",
  },
  {
    title: "For the administration",
    body: "Create accounts, group members into cohorts, publish a course when it is ready, and see who has finished what across the whole platform.",
  },
]

const faqs = [
  {
    q: "I do not have an account yet.",
    a: "Accounts are created by the church administration. Ask the pastor or the membership officer in your assembly to enrol you.",
  },
  {
    q: "I cannot get in.",
    a: "Use Forgot password on the sign-in page. A reset link goes to the email address on your account.",
  },
  {
    q: "Do I have to finish a lesson in one sitting?",
    a: "No. Your place in a lesson and your progress through a course are saved, so you can stop and return.",
  },
  {
    q: "What do I need to take a course?",
    a: "A phone, tablet or computer with a browser. There is nothing to install.",
  },
]

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 text-[1.75rem] leading-snug text-ink sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 text-base leading-relaxed text-gray-600">{lead}</p> : null}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <div className="leading-tight">
              <div className="text-[0.95rem] font-semibold text-brand">Living Faith Foundation</div>
              <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                Learning Portal
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a className="hover:text-brand" href="#includes">
              What a course includes
            </a>
            <a className="hover:text-brand" href="#how">
              How it works
            </a>
            <a className="hover:text-brand" href="#access">
              Getting access
            </a>
          </nav>

          <Link
            href="/auth/login"
            className="shrink-0 whitespace-nowrap rounded-sm bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-rule">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Teaching the Foundation, lesson by lesson
              </p>
              <h1 className="mt-5 text-[2rem] leading-[1.15] text-ink sm:text-5xl">
                The learning portal of the Living Faith Foundation
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
                Structured courses in the foundations of the faith, the life of the church family,
                doctrine, leadership and stewardship — taught in video, with written notes for every
                lesson and questions that appear inside the teaching itself.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/auth/login"
                  className="rounded-sm bg-brand px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Sign in to the portal
                </Link>
                <a
                  href="#includes"
                  className="rounded-sm border border-gray-300 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  What a course includes
                </a>
              </div>
              <p className="mt-8 max-w-xl border-l-2 border-gold pl-4 text-sm leading-relaxed text-gray-500">
                Accounts are created for members by the church administration. If you have studied
                here before, your progress and your certificates are still on your account.
              </p>
            </div>

            <figure>
              <div className="overflow-hidden rounded-md border border-rule bg-white shadow-[0_24px_50px_-30px_rgba(23,32,27,0.55)]">
                <div className="relative aspect-[16/7.2] w-full">
                  <Image
                    src="/image.png"
                    alt="The student dashboard, showing enrolled courses, certificates and upcoming live classes."
                    fill
                    priority
                    sizes="(min-width: 1024px) 46vw, 100vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>
              <figcaption className="mt-3 text-xs leading-relaxed text-gray-500">
                A member’s dashboard: the courses in progress, the classes coming up, and the
                certificates already earned.
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="includes" className="scroll-mt-24 border-b border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="What a course includes"
              title="Everything a class needs, kept in one place"
              lead="A course is a set of modules, a module is a set of lessons, and a lesson is teaching you can return to."
            />
            <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
              {includes.map((item) => (
                <div key={item.title} className="bg-white p-7">
                  <h3 className="text-base font-semibold text-brand">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 border-b border-rule">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <SectionHeading eyebrow="How it works" title="Four steps from sign-in to certificate" />
            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <li key={step.title} className="border-t border-ink/15 pt-5">
                  <div className="text-xs font-semibold tracking-[0.18em] text-gold">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-rule bg-brand-soft">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <SectionHeading eyebrow="Who it is for" title="One portal, three kinds of user" />
            <div className="mt-12 grid gap-10 lg:grid-cols-3">
              {roles.map((role) => (
                <div key={role.title} className="border-l-2 border-brand pl-5">
                  <h3 className="text-lg font-semibold text-ink">{role.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{role.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-rule">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_1.15fr] lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="On the portal now"
              title="Family Classes"
              lead="Twenty-two lessons across four modules — Introduction, The Foundations of the Faith, The Family and The Church Worker. Just under six hours of teaching from the Sanctuary of Grace in Ikeja, with notes and questions for every lesson."
            />
            <div className="self-center">
              <dl className="divide-y divide-rule border-y border-rule text-sm">
                {[
                  ["Modules", "Four, taken in order or by subject"],
                  ["Lessons", "Twenty-two recorded teachings"],
                  ["With each lesson", "Written notes and four timed questions"],
                  ["At the end", "A course exam and a certificate"],
                ].map(([term, value]) => (
                  <div key={term} className="flex flex-wrap justify-between gap-2 py-4">
                    <dt className="font-semibold text-ink">{term}</dt>
                    <dd className="text-gray-600">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-gray-500">
                Further programmes are added by the teaching and leadership teams of the Foundation
                as they are recorded.
              </p>
            </div>
          </div>
        </section>

        <section id="access" className="scroll-mt-24 border-b border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="Getting access"
              title="Questions people ask before they start"
            />
            <div className="mt-12 grid gap-x-14 gap-y-9 sm:grid-cols-2">
              {faqs.map((item) => (
                <div key={item.q} className="border-t border-rule pt-5">
                  <h3 className="text-base font-semibold text-ink">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand">
          <div className="mx-auto flex max-w-6xl flex-col gap-7 px-5 py-14 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div>
              <h2 className="text-2xl leading-snug text-white sm:text-3xl">
                Continue where your last class left off
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
                Sign in with the account your assembly gave you. Your lessons, notes and
                certificates are waiting on the other side.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="shrink-0 rounded-sm bg-white px-7 py-3.5 text-center text-sm font-semibold text-brand transition-colors hover:bg-gold hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <div className="text-sm leading-tight text-gray-600">
              <div className="font-semibold text-ink">Living Faith Foundation</div>
              <div>Learning Portal</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <Link className="hover:text-brand" href="/auth/login">
              Sign in
            </Link>
            <Link className="hover:text-brand" href="/auth/forgot-password">
              Forgot password
            </Link>
          </nav>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Living Faith Foundation. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
