import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createBulkNotifications } from "@/lib/notifications"
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

    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
        attachments: true
      },
    })

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(announcement)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch announcement" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ANNOUNCEMENTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { published } = body

    if (typeof published !== "boolean") {
      return NextResponse.json(
        { error: "Published status is required" },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.update({
      where: { id: params.id },
      data: {
        published,
        publishedAt: published ? new Date() : null,
      },
      include: {
        creator: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      published ? "PUBLISH" : "UNPUBLISH",
      "Announcement",
      request,
      {
        entityId: params.id,
        description: `${published ? "Published" : "Unpublished"} announcement: ${announcement.title}`,
      }
    )

    // Create notifications when publishing
    if (published) {
      const existingAnnouncement = await prisma.announcement.findUnique({
        where: { id: params.id },
      })

      if (existingAnnouncement) {
        let userIds: string[] = []
        
        if (existingAnnouncement.targetAudience === "ALL") {
          const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true },
          })
          userIds = users.map((u) => u.id)
        } else if (existingAnnouncement.targetAudience === "STUDENTS") {
          const students = await prisma.student.findMany({
            include: { user: true },
          })
          userIds = students.map((s) => s.userId)
        } else if (existingAnnouncement.targetAudience === "TEACHERS") {
          const staff = await prisma.staff.findMany({
            where: { designation: "TEACHER" },
            include: { user: true },
          })
          userIds = staff.map((s) => s.userId)
        } else if (existingAnnouncement.targetClassId) {
          const enrollments = await prisma.classEnrollment.findMany({
            where: { classId: existingAnnouncement.targetClassId },
            include: { student: { include: { user: true } } },
          })
          userIds = enrollments.map((e) => e.student.userId)
        }

        if (userIds.length > 0) {
          await createBulkNotifications(userIds, {
            title: "New Announcement",
            message: existingAnnouncement.title,
            type: "INFO",
            category: "ANNOUNCEMENT",
            link: `/dashboard/announcements`,
            metadata: { announcementId: params.id },
          })
        }
      }
    }

    return NextResponse.json(announcement)
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update announcement" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ANNOUNCEMENTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get announcement info before deletion for audit trail
    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
    })

    // Log audit trail before deletion
    if (announcement) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Announcement",
        request,
        {
          entityId: params.id,
          description: `Deleted announcement: ${announcement.title}`,
        }
      )
    }

    await prisma.announcement.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Announcement deleted successfully" })
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to delete announcement" },
      { status: 500 }
    )
  }
}

