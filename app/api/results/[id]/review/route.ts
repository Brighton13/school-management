import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { approved, submitToPrincipal } = body

    const existingResult = await prisma.result.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            classEnrollment: {
              include: {
                section: {
                  include: {
                    classTeacher: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!existingResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 })
    }

    // Verify the teacher is the class teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
    })

    const studentEnrollment = await prisma.classEnrollment.findFirst({
      where: { studentId: existingResult.studentId },
      include: {
        section: {
          include: {
            classTeacher: true,
          },
        },
      },
    })

    if (!studentEnrollment?.section?.classTeacher || 
        studentEnrollment.section.classTeacher.id !== staff?.id) {
      return NextResponse.json(
        { error: "You are not the class teacher for this student" },
        { status: 403 }
      )
    }

    if (existingResult.status !== "PENDING_CLASS_TEACHER") {
      return NextResponse.json(
        { error: "Result is not pending class teacher review" },
        { status: 400 }
      )
    }

    const updatedResult = await prisma.result.update({
      where: { id: params.id },
      data: {
        status: approved
          ? submitToPrincipal
            ? "PENDING_APPROVAL"
            : "APPROVED"
          : "REJECTED",
        reviewedBy: approved ? session.user.id : null,
        reviewedAt: approved ? new Date() : null,
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

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      approved ? (submitToPrincipal ? "REVIEW" : "APPROVE") : "REJECT",
      "Result",
      request,
      {
        entityId: params.id,
        description: `Class teacher ${approved ? (submitToPrincipal ? "reviewed and submitted" : "approved") : "rejected"} result for ${updatedResult.student.user.name} - ${updatedResult.classSubject.subject.name}`,
      }
    )

    return NextResponse.json(updatedResult)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process review" },
      { status: 500 }
    )
  }
}

