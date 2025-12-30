import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const status = searchParams.get("status")
    const academicYear = searchParams.get("academicYear")

    const applications = await prisma.application.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(status ? { applicationStatus: status } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        appliedClass: true,
        appliedSection: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(applications)
  } catch (error) {
    console.error("Failed to fetch applications:", error)
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, appliedClassId, appliedSectionId, academicYear, notes } = body

    // Validate required fields
    if (!studentId || !appliedClassId || !academicYear) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    })

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      )
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        studentId_appliedClassId_academicYear: {
          studentId,
          appliedClassId,
          academicYear,
        },
      },
    })

    if (existingApplication) {
      return NextResponse.json(
        { error: "Application already exists for this student, class, and academic year" },
        { status: 400 }
      )
    }

    const application = await prisma.application.create({
      data: {
        studentId,
        appliedClassId,
        appliedSectionId: appliedSectionId || null,
        academicYear,
        notes: notes || null,
        createdBy: session.user.id,
      },
      include: {
        student: {
          include: { user: true },
        },
        appliedClass: true,
        appliedSection: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Application",
      request,
      {
        entityId: application.id,
        description: `Created application for ${student.user.name} to ${application.appliedClass.name}`,
      }
    )

    return NextResponse.json(application, { status: 201 })
  } catch (error: any) {
    console.error("Failed to create application:", error)
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    )
  }
}
