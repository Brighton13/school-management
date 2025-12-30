import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, termId, academicYearId, examId } = body

    // Get staff member
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          where: { id: sectionId },
        },
      },
    })

    if (!staff || staff.sections.length === 0) {
      return NextResponse.json(
        { error: "You are not the class teacher for this section" },
        { status: 403 }
      )
    }

    // Get all enrollments for this section
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        student: true,
      },
    })

    const studentIds = enrollments.map(e => e.studentId)

    // Get all results for these students that are pending class teacher review
    const results = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        ...(termId ? { termId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        ...(examId ? { examId } : {}),
        status: "PENDING_CLASS_TEACHER",
      },
    })

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No results pending submission for this class" },
        { status: 400 }
      )
    }

    // Update all results to pending approval
    const updatedResults = await prisma.result.updateMany({
      where: {
        id: { in: results.map(r => r.id) },
      },
      data: {
        status: "PENDING_APPROVAL",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    })

    // Log audit trail for bulk submission
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Result",
      request,
      {
        description: `Class teacher submitted ${updatedResults.count} results for approval (Section ID: ${sectionId})`,
        metadata: { count: updatedResults.count, sectionId, termId, academicYearId, examId },
      }
    )

    return NextResponse.json({
      message: `Successfully submitted ${updatedResults.count} results for approval`,
      count: updatedResults.count,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to submit class results" },
      { status: 500 }
    )
  }
}

