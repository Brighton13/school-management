import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { rejectionReason } = body

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

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
        // Update application status to REJECTED
        await prisma.application.update({
          where: { id: application.id },
          data: {
            applicationStatus: "REJECTED",
            notes: rejectionReason.trim(),
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
    console.error("Bulk reject error:", error)
    return NextResponse.json(
      { error: "Failed to bulk reject applications", details: error.message },
      { status: 500 }
    )
  }
}
