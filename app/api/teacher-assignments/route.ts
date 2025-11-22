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
    const teacherId = searchParams.get("teacherId")
    const classId = searchParams.get("classId")

    const assignments = await prisma.classSubject.findMany({
      where: {
        ...(teacherId ? { teacherId } : {}),
        ...(classId ? { classId } : {}),
      },
      include: {
        class: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch teacher assignments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classSubjectId, teacherId } = body

    const assignment = await prisma.classSubject.update({
      where: { id: classSubjectId },
      data: { teacherId },
      include: {
        class: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ClassSubject",
      request,
      {
        entityId: classSubjectId,
        description: `Assigned teacher ${assignment.teacher?.user.name || "N/A"} to ${assignment.class.name} - ${assignment.subject.name}`,
      }
    )

    return NextResponse.json(assignment, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to assign teacher" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classSubjectId = searchParams.get("classSubjectId")

    if (!classSubjectId) {
      return NextResponse.json({ error: "classSubjectId required" }, { status: 400 })
    }

    // Get class-subject info before update for audit trail
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: {
        class: true,
        subject: true,
        teacher: { include: { user: true } },
      },
    })

    await prisma.classSubject.update({
      where: { id: classSubjectId },
      data: { teacherId: null },
    })

    // Log audit trail
    if (classSubject) {
      await logAuditTrail(
        session.user.id,
        "UPDATE",
        "ClassSubject",
        request,
        {
          entityId: classSubjectId,
          description: `Removed teacher assignment from ${classSubject.class.name} - ${classSubject.subject.name}`,
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove assignment" },
      { status: 500 }
    )
  }
}

