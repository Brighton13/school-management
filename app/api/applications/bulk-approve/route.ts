import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAcademicContext } from "@/lib/academic-year"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId } = body

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section ID is required" },
        { status: 400 }
      )
    }

    // Get current academic context - this is the single source of truth
    const context = await getAcademicContext()

    // Fetch all pending applications
    const pendingApplications = await prisma.application.findMany({
      where: {
        applicationStatus: "PENDING",
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        appliedClass: true,
      },
    })

    if (pendingApplications.length === 0) {
      return NextResponse.json(
        { error: "No pending applications found" },
        { status: 404 }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each application
    for (const application of pendingApplications) {
      try {
        // Check if student already enrolled for this academic year
        const existingEnrollment = await prisma.classEnrollment.findFirst({
          where: {
            studentId: application.studentId,
            academicYearId: context.academicYearId,
          },
        })

        if (existingEnrollment) {
          results.failed++
          results.errors.push(
            `${application.student.user.name}: Already enrolled for ${context.academicYear}`
          )
          continue
        }

        // Enroll the student in current academic year
        await prisma.classEnrollment.create({
          data: {
            studentId: application.studentId,
            classId: application.appliedClassId,
            sectionId: sectionId,
            academicYearId: context.academicYearId,
          },
        })

        // Update application status
        await prisma.application.update({
          where: { id: application.id },
          data: {
            applicationStatus: "APPROVED",
            approvedBy: session.user.id,
            approvedAt: new Date(),
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push(
          `${application.student.user.name}: ${error.message}`
        )
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("Bulk approve error:", error)
    return NextResponse.json(
      { error: "Failed to bulk approve applications", details: error.message },
      { status: 500 }
    )
  }
}
