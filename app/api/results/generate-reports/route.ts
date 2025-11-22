import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, sectionId, academicTermId, examId, sendToStudent } = body

    // Verify teacher is class teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          where: sectionId ? { id: sectionId } : undefined,
        },
      },
    })

    if (!staff || staff.sections.length === 0) {
      return NextResponse.json(
        { error: "You are not authorized to generate reports for this class" },
        { status: 403 }
      )
    }

    // Get student enrollment to verify
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId,
        sectionId: { in: staff.sections.map(s => s.id) },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Student not found in your class" },
        { status: 404 }
      )
    }

    // Get all approved results for this student
    const results = await prisma.result.findMany({
      where: {
        studentId,
        ...(academicTermId ? { academicTermId } : {}),
        ...(examId ? { examId } : {}),
        status: { in: ["APPROVED", "PUBLISHED"] },
      },
      include: {
        student: {
          include: { user: true },
        },
        classSubject: {
          include: {
            subject: true,
            class: true,
            teacher: {
              include: { user: true },
            },
          },
        },
        academicTerm: true,
        exam: true,
      },
    })

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No approved results found for this student" },
        { status: 404 }
      )
    }

    // Generate report data
    const reportData = {
      student: results[0].student,
      enrollment,
      results,
      generatedAt: new Date(),
      generatedBy: session.user.id,
    }

    // If sendToStudent is true, mark as sent (you can implement email/SMS sending here)
    if (sendToStudent) {
      // TODO: Implement email/SMS sending to student
      // For now, just return the report data
    }

    return NextResponse.json({
      message: "Report generated successfully",
      report: reportData,
      sendToStudent: sendToStudent || false,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}

