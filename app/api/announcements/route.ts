import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createBulkNotifications } from "@/lib/notifications"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    // Build where clause based on user role
    const whereClause: any = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    }

    // Admins and principals can see all announcements (published and unpublished)
    // Others only see published announcements
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      whereClause.published = true
    }

    const announcements = await prisma.announcement.findMany({
      where: whereClause,
      include: {
        creator: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(announcements)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
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
    const {
      title,
      content,
      type,
      targetAudience,
      targetClassId,
      targetSectionId,
      expiresAt,
      published,
    } = body

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        type,
        targetAudience,
        targetClassId: targetClassId || null,
        targetSectionId: targetSectionId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        published: published || false,
        publishedAt: published ? new Date() : null,
        createdBy: session.user.id,
      },
      include: {
        creator: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Announcement",
      request,
      {
        entityId: announcement.id,
        description: `Created announcement: ${title}`,
      }
    )

    // Create notifications for target audience
    if (announcement.published) {
      let userIds: string[] = []
      
      if (targetAudience === "ALL") {
        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        })
        userIds = users.map((u) => u.id)
      } else if (targetAudience === "STUDENTS") {
        const students = await prisma.student.findMany({
          include: { user: true },
        })
        userIds = students.map((s) => s.userId)
      } else if (targetAudience === "TEACHERS") {
        const staff = await prisma.staff.findMany({
          where: { designation: "TEACHER" },
          include: { user: true },
        })
        userIds = staff.map((s) => s.userId)
      } else if (targetClassId) {
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId: targetClassId },
          include: { student: { include: { user: true } } },
        })
        userIds = enrollments.map((e) => e.student.userId)
      }

      if (userIds.length > 0) {
        await createBulkNotifications(userIds, {
          title: "New Announcement",
          message: title,
          type: "INFO",
          category: "ANNOUNCEMENT",
          link: `/dashboard/announcements`,
          metadata: { announcementId: announcement.id },
        })
      }
    }

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    )
  }
}

