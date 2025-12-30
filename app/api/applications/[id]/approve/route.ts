import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { validateEnrollmentAcademicYear } from "@/lib/academic-year"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, academicYearId } = body

    // Get the application
    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
        appliedClass: true,
        academicYear: true,
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      )
    }

    if (application.applicationStatus !== "PENDING") {
      return NextResponse.json(
        { error: "Application has already been processed" },
        { status: 400 }
      )
    }

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section is required for approval" },
        { status: 400 }
      )
    }

    // Use provided academicYearId or the one from application
    const finalAcademicYearId = academicYearId || application.academicYearId

    // Validate academic year
    const validation = await validateEnrollmentAcademicYear(finalAcademicYearId)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      )
    }

    // Check if student is already enrolled in this class for the academic year
    const existingEnrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId: application.studentId,
        classId: application.appliedClassId,
        academicYearId: finalAcademicYearId,
      },
    })

    if (existingEnrollment) {
      return NextResponse.json(
        { error: `Student is already enrolled in this class for ${validation.academicYear?.year}` },
        { status: 400 }
      )
    }

    // Transaction: Approve application and create enrollment
    const result = await prisma.$transaction(async (tx) => {
      // Update application status
      const updatedApplication = await tx.application.update({
        where: { id: params.id },
        data: {
          applicationStatus: "APPROVED",
          appliedSectionId: sectionId,
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      })

      // Create enrollment
      const enrollment = await tx.classEnrollment.create({
        data: {
          studentId: application.studentId,
          classId: application.appliedClassId,
          sectionId: sectionId,
          academicYearId: finalAcademicYearId,
        },
      })

      return { application: updatedApplication, enrollment }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "APPROVE",
      "Application",
      request,
      {
        entityId: params.id,
        description: `Approved application and enrolled ${application.student.user.name} in ${application.appliedClass.name}`,
      }
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Failed to approve application:", error)
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Student already enrolled in this class and section" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to approve application" },
      { status: 500 }
    )
  }
}
