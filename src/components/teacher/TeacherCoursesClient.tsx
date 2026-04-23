"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { BookOpen, Plus, ChevronRight, LayoutGrid, List, ChevronLeft } from "lucide-react"
import { CreateCourseDialog } from "@/components/teacher/CreateCourseDialog"

interface Course {
  id: string
  title: string
  description: string
  isPaid: boolean
  price: number
  isPublished: boolean
  createdAt: string
}

const PAGE_SIZE = 10

export function TeacherCoursesClient({ courses }: { courses: Course[] }) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(courses.length / PAGE_SIZE))
  const paginated = courses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Courses</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage your courses</p>
        </div>
        <div className="flex items-center gap-3">
          {courses.length > 0 && (
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1.5 transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          )}
          <CreateCourseDialog>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </CreateCourseDialog>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No courses yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first course to get started</p>
            </div>
            <CreateCourseDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </CreateCourseDialog>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ── */
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium max-w-[200px]">
                          <span className="line-clamp-1">{course.title}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[260px]">
                          <span className="line-clamp-1">{course.description}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={course.isPaid ? "outline" : "secondary"} className="text-xs">
                            {course.isPaid ? `Paid · ₦${course.price.toLocaleString()}` : "Free"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={course.isPublished ? "default" : "secondary"} className="text-xs">
                            {course.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(course.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm" className="text-xs h-7">
                            <Link href={`/teacher/courses/${course.id}`}>
                              Manage <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, courses.length)}–{Math.min(page * PAGE_SIZE, courses.length)} of {courses.length} courses
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">Page {page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* ── GRID VIEW ── */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((course) => (
              <Card key={course.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{course.title}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={course.isPublished ? "default" : "secondary"} className="shrink-0">
                        {course.isPublished ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant={course.isPaid ? "outline" : "secondary"} className="shrink-0">
                        {course.isPaid ? `Paid - NGN ${course.price.toLocaleString()}` : "Free"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/teacher/courses/${course.id}`}>
                      Manage Course <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, courses.length)}–{Math.min(page * PAGE_SIZE, courses.length)} of {courses.length} courses
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">Page {page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
