import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

// Default points configuration (fallback if no config in DB)
const defaultPointsConfig = [
  { minPercentage: 75, maxPercentage: 100, points: 1 },
  { minPercentage: 65, maxPercentage: 74.99, points: 2 },
  { minPercentage: 50, maxPercentage: 64.99, points: 3 },
  { minPercentage: 40, maxPercentage: 49.99, points: 4 },
  { minPercentage: 30, maxPercentage: 39.99, points: 5 },
  { minPercentage: 1, maxPercentage: 29.99, points: 6 },
  { minPercentage: 0, maxPercentage: 0.99, points: 7 },
]

// Helper function to calculate points based on percentage
async function calculatePoints(marksObtained: number, maxMarks: number): Promise<number> {
  if (maxMarks <= 0) return 7
  const percentage = Math.round((marksObtained / maxMarks) * 100)
  
  // Try to get points config from database
  const pointsConfig = await prisma.pointsConfig.findMany({
    where: { isActive: true },
    orderBy: { minPercentage: 'desc' },
  })
  
  const config = pointsConfig.length > 0 ? pointsConfig : defaultPointsConfig
  
  const matchingConfig = config.find(
    (pc) => percentage >= pc.minPercentage && percentage <= pc.maxPercentage
  )
  
  return matchingConfig?.points || 7
}

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

    // For teachers, verify assignment and only allow editing until principal approves
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

      // Allow editing until principal approves (DRAFT, PENDING_CLASS_TEACHER, PENDING_APPROVAL, REJECTED)
      const editableStatuses = ["DRAFT", "PENDING_CLASS_TEACHER", "PENDING_APPROVAL", "REJECTED"]
      if (!editableStatuses.includes(existingResult.status)) {
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
    
    // Recalculate points based on new marks
    updateData.points = await calculatePoints(parseFloat(marksObtained), parseFloat(maxMarks))
    
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

