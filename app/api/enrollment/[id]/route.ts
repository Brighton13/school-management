import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const enrollment = await prisma.classEnrollment.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
      },
    })

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    return NextResponse.json(enrollment)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch enrollment" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classId, sectionId, academicYear, term, status } = body

    const updatedEnrollment = await prisma.classEnrollment.update({
      where: { id: params.id },
      data: {
        classId,
        sectionId,
        academicYear,
        term,
        status: status || "ACTIVE",
      },
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Enrollment",
      request,
      {
        entityId: params.id,
        description: `Updated enrollment: ${updatedEnrollment.student.user.name} in ${updatedEnrollment.class.name} - ${updatedEnrollment.section.name}`,
      }
    )

    return NextResponse.json(updatedEnrollment)
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Student already enrolled in this class and section" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update enrollment" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get enrollment info before deletion for audit trail
    const enrollment = await prisma.classEnrollment.findUnique({
      where: { id: params.id },
      include: {
        student: { include: { user: true } },
        class: true,
        section: true,
      },
    })

    // Log audit trail before deletion
    if (enrollment) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Enrollment",
        request,
        {
          entityId: params.id,
          description: `Deleted enrollment: ${enrollment.student.user.name} from ${enrollment.class.name} - ${enrollment.section.name}`,
        }
      )
    }

    await prisma.classEnrollment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete enrollment" },
      { status: 500 }
    )
  }
}

