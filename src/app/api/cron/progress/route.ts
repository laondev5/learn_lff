import { checkStudentProgress } from "@/lib/cron"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET|POST /api/cron/progress
 * Scores every module whose 24-hour window has closed, records absences once and
 * emails the student's accepted accountability partner. Protect it with
 * `Authorization: Bearer $CRON_SECRET` and schedule it at least every hour.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  const header = req.headers.get("authorization") ?? ""
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await checkStudentProgress(new Date())
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[CRON_PROGRESS]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export const GET = run
export const POST = run
