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

    // Get current academic context - this is the single source of truth
    const context = await getAcademicContext()

    // Fetch all pending applications with their intended class and section
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
        appliedSection: true,
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

    // Process each application using their own intended class and section
    for (const application of pendingApplications) {
      try {
        // Validate that application has required fields
        if (!application.appliedSectionId) {
          results.failed++
          results.errors.push(
            `${application.student.user.name}: No section specified in application`
          )
          continue
        }

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

        // Enroll the student using THEIR intended class and section
        await prisma.classEnrollment.create({
          data: {
            studentId: application.studentId,
            classId: application.appliedClassId,
            sectionId: application.appliedSectionId,
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
