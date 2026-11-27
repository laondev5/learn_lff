import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  X,
} from "lucide-react"
import {
  getPublicCourses,
  type PublicCourseFilters,
  type PublicCourseStatus,
} from "@/lib/public-courses"
import { CourseCover } from "@/components/student/CourseCards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Courses | Living Faith Foundation Learning Portal" }

const PAGE_SIZE = 6

type SearchParams = Record<string, string | string[] | undefined>
type PageItem = number | `ellipsis-${number}`

function lagosDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        timeZone: "Africa/Lagos",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—"
}

function courseHref(
  filters: Pick<PublicCourseFilters, "search" | "status" | "price">,
  page: number
) {
  const params = new URLSearchParams()
  if (filters.search) params.set("q", filters.search)
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.price && filters.price !== "all") params.set("price", filters.price)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/courses?${query}` : "/courses"
}

function paginationItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
  const items: PageItem[] = []

  pages.forEach((page, index) => {
    const previous = pages[index - 1]
    if (previous && page - previous > 1) items.push(`ellipsis-${previous}`)
    items.push(page)
  })

  return items
}

export default async function PublicCoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const status: PublicCourseStatus | "all" =
    params.status === "open" || params.status === "started" || params.status === "none"
      ? params.status
      : "all"
  const price: "all" | "free" | "paid" =
    params.price === "free" || params.price === "paid" ? params.price : "all"
  const parsedPage = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const result = await getPublicCourses({ search, status, price, page, pageSize: PAGE_SIZE })
  const hasFilters = Boolean(search) || status !== "all" || price !== "all"
  const firstResult = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const lastResult = Math.min(result.page * result.pageSize, result.total)

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-brand">Living Faith Foundation</div>
                <div className="text-xs uppercase tracking-[0.14em] text-gray-500">Learning Portal</div>
              </div>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-gray-600">
              <Link href="/apply" className="font-medium text-brand hover:text-brand-dark">Apply for a cohort</Link>
              <Link href="/auth/login" className="hover:text-brand">Sign in</Link>
            </nav>
          </div>
          <div className="mt-12 max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Learn at your own pace</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Find your next course</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-600">
              Structured teaching in the foundations of the faith, the life of the church family and ministry.
              Search the catalogue, compare cohorts and apply when registration opens.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-10 lg:px-8 lg:py-14">
        <form action="/courses" className="rounded-2xl border border-rule bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_170px_auto] md:items-end">
            <div className="space-y-2">
              <label htmlFor="course-search" className="text-sm font-medium">Search courses</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="course-search"
                  name="q"
                  type="search"
                  defaultValue={search}
                  placeholder="Title, topic or teacher"
                  className="h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="course-status" className="text-sm font-medium">Availability</label>
              <select
                id="course-status"
                name="status"
                defaultValue={status}
                className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All courses</option>
                <option value="open">Applications open</option>
                <option value="none">Cohort coming soon</option>
                <option value="started">Registration closed</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="course-price" className="text-sm font-medium">Price</label>
              <select
                id="course-price"
                name="price"
                defaultValue={price}
                className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Free and paid</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <Button type="submit" className="h-12 rounded-xl px-6 text-base font-semibold shadow-sm">
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>
          {hasFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4 text-sm">
              <span className="text-muted-foreground">Active filters:</span>
              {search && <Badge variant="secondary">“{search}”</Badge>}
              {status !== "all" && (
                <Badge variant="secondary">
                  {status === "open" ? "Applications open" : status === "none" ? "Cohort coming soon" : "Registration closed"}
                </Badge>
              )}
              {price !== "all" && <Badge variant="secondary">{price === "free" ? "Free" : "Paid"}</Badge>}
              <Link href="/courses" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <X className="h-3.5 w-3.5" /> Clear all
              </Link>
            </div>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p aria-live="polite">
            {result.total === 0
              ? "No courses found"
              : `Showing ${firstResult}–${lastResult} of ${result.total} ${result.total === 1 ? "course" : "courses"}`}
          </p>
          {result.totalPages > 1 && <p>Page {result.page} of {result.totalPages}</p>}
        </div>

        {result.courses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary/40" />
              <h2 className="text-lg font-semibold">
                {hasFilters ? "No courses match your filters" : "No courses are published yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {hasFilters
                  ? "Try a broader search or clear the filters to see the full catalogue."
                  : "New teaching is added by the Foundation team. Please check back soon."}
              </p>
              {hasFilters && (
                <Button asChild variant="outline" className="mt-6">
                  <Link href="/courses">View all courses</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.courses.map((course) => (
              <Card key={course.id} className="group h-full overflow-hidden">
                <Link href={`/courses/${course.id}`} aria-label={`View ${course.title}`}>
                  <CourseCover
                    url={course.coverImageUrl}
                    title={course.title}
                    className="h-48 w-full"
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                  />
                </Link>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={course.status === "open" ? "default" : "secondary"}>
                      {course.status === "open"
                        ? "Applications open"
                        : course.status === "started"
                          ? "Registration closed"
                          : "Cohort coming soon"}
                    </Badge>
                    <Badge variant="outline">{course.isPaid ? `₦${course.price.toLocaleString()}` : "Free"}</Badge>
                  </div>
                  <CardTitle className="text-lg">
                    <Link href={`/courses/${course.id}`} className="hover:underline">{course.title}</Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{course.moduleCount} modules · {course.teacherName}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-4">
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
                  <div className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    {course.status === "open" ? (
                      <><CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {course.cohortName} · starts {course.startDate} · apply by {lagosDate(course.registrationClosesAt)}</>
                    ) : course.status === "started" ? (
                      <><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {course.cohortName} registration closed {lagosDate(course.registrationClosesAt)} — wait for the next cohort</>
                    ) : (
                      <><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No cohort scheduled yet</>
                    )}
                  </div>
                  <Button asChild variant="outline" className="mt-auto w-full">
                    <Link href={`/courses/${course.id}`}>
                      View course <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {result.totalPages > 1 && (
          <nav aria-label="Course pages" className="flex flex-col items-center justify-between gap-4 border-t border-rule pt-6 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {result.page > 1 ? (
                <Link
                  href={courseHref({ search, status, price }, result.page - 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : (
                <span className="inline-flex h-10 cursor-not-allowed items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium opacity-50" aria-disabled="true">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </span>
              )}

              {paginationItems(result.page, result.totalPages).map((item) =>
                typeof item === "number" ? (
                  <Link
                    key={item}
                    href={courseHref({ search, status, price }, item)}
                    aria-current={item === result.page ? "page" : undefined}
                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors ${
                      item === result.page
                        ? "border-brand bg-brand text-white"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {item}
                  </Link>
                ) : (
                  <span key={item} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
                )
              )}

              {result.page < result.totalPages ? (
                <Link
                  href={courseHref({ search, status, price }, result.page + 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  aria-label="Next page"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="inline-flex h-10 cursor-not-allowed items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium opacity-50" aria-disabled="true">
                  Next <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Already have an account? <Link href="/auth/login" className="text-primary underline">Sign in</Link> to continue, or <Link href="/apply" className="text-primary underline">apply here</Link>.
        </div>
      </div>
    </main>
  )
}
