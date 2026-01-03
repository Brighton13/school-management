import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await prisma.result.findUnique({
      where: { id: params.id },
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
        term: true,
        academicYear: true,
        exam: true,
      },
    })

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch result" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      examType,
      marksObtained,
      maxMarks,
      grade,
      remarks,
    } = body

    // Get existing result
    const existingResult = await prisma.result.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          include: {
            teacher: true,
          },
        },
      },
    })

    if (!existingResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 })
    }

    // For teachers, verify assignment and only allow editing if status is DRAFT or PENDING_APPROVAL
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          classSubjects: {
            where: { id: existingResult.classSubjectId },
          },
        },
      })

      if (!staff || staff.classSubjects.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to this class-subject" },
          { status: 403 }
        )
      }

      if (!["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(existingResult.status)) {
        return NextResponse.json(
          { error: "Cannot edit approved or published results" },
          { status: 403 }
        )
      }
    }

    const updateData: any = {
      marksObtained: parseFloat(marksObtained),
      maxMarks: parseFloat(maxMarks),
      grade,
      remarks,
    }
    
    if (examType) {
      updateData.examType = examType
    }
    
    // If teacher updates, resubmit for approval
    if (session.user.role === "TEACHER" && existingResult.status !== "DRAFT") {
      updateData.status = "PENDING_APPROVAL"
      updateData.submittedBy = session.user.id
      updateData.submittedAt = new Date()
    }

    const updatedResult = await prisma.result.update({
      where: { id: params.id },
      data: updateData,
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
        term: true,
        academicYear: true,
        exam: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Result",
      request,
      {
        entityId: params.id,
        description: `Updated result for ${updatedResult.student.user.name} - ${updatedResult.classSubject.subject.name} (${updatedResult.marksObtained}/${updatedResult.maxMarks})`,
      }
    )

    return NextResponse.json(updatedResult)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get result info before deletion for audit trail
    const result = await prisma.result.findUnique({
      where: { id: params.id },
      include: {
        student: { include: { user: true } },
        classSubject: { include: { subject: true } },
      },
    })

    // Log audit trail before deletion
    if (result) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Result",
        request,
        {
          entityId: params.id,
          description: `Deleted result for ${result.student.user.name} - ${result.classSubject.subject.name}`,
        }
      )
    }

    await prisma.result.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete result" },
      { status: 500 }
    )
  }
}

