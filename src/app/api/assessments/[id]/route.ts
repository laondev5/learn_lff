import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Assessment from "@/models/Assessment.model"
import { assessmentSchema } from "@/lib/validations/assessment"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const assessment = await Assessment.findById(id)
      .populate("course", "title")
      .populate("module", "title")

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    return NextResponse.json({ assessment })
  } catch (error: unknown) {
    console.error("[ASSESSMENT_SINGLE_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = assessmentSchema.partial().safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await connectDB()

    // Ensure teacher owns assessment
    const assessment = await Assessment.findOne({ _id: id, createdBy: session.user.id })
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found or unauthorized" }, { status: 404 })
    }

    // Recalculate total marks if questions are updated
    if (parsed.data.questions) {
      parsed.data.totalMarks = parsed.data.questions.reduce((sum: number, q) => sum + q.points, 0)
    }

    const updated = await Assessment.findByIdAndUpdate(
      id,
      { ...parsed.data },
      { new: true }
    )

    return NextResponse.json({ success: true, assessment: updated })
  } catch (error: unknown) {
    console.error("[ASSESSMENT_PATCH]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    // Ensure teacher owns assessment
    const assessment = await Assessment.findOneAndDelete({ _id: id, createdBy: session.user.id })
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found or unauthorized" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Assessment deleted" })
  } catch (error: unknown) {
    console.error("[ASSESSMENT_DELETE]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
