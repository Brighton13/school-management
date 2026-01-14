import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createBulkNotifications } from "@/lib/notifications"
import { requirePermission, Permissions, hasPermission } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

// Helper function to get MIME type from filename
function getMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  }
  return mimeTypes[extension || ''] || 'application/octet-stream'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const targetAudience = searchParams.get("targetAudience")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)
    
    // Build where clause based on user role
    const whereClause: any = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    }

    // Users with announcements.create permission can see all announcements (published and unpublished)
    // Others only see published announcements
    const canSeeAll = session ? await hasPermission(session.user.id, Permissions.ANNOUNCEMENTS_CREATE) : false
    if (!canSeeAll) {
      whereClause.published = true
    }

    // Add search filter
    if (search) {
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ]
      })
    }

    if (type) {
      whereClause.type = type
    }

    if (targetAudience) {
      whereClause.targetAudience = targetAudience
    }

    // Get total count
    const total = await prisma.announcement.count({ where: whereClause })

    const announcements = await prisma.announcement.findMany({
      where: whereClause,
      include: {
        creator: true,
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(announcements)
    }

    return NextResponse.json(createPaginatedResponse(announcements, total, page, limit))
  } catch (error: any) {
    console.error("Error fetching announcements:", error?.message || error)
    
    // Return empty array for database errors so the UI can handle it gracefully
    return NextResponse.json(
      { 
        error: "Failed to fetch announcements",
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
          hasMore: false,
          hasPrevious: false,
        }
      },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ANNOUNCEMENTS_CREATE)
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
      attachments,
    } = body

    console.log("Creating announcement with attachments:", attachments)

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
        attachments: attachments && attachments.length > 0 ? {
          create: attachments.map((file: { filename: string; url: string }) => ({
            fileName: file.filename,
            originalName: file.filename.split('-').slice(2).join('-') || file.filename,
            fileSize: 0, // We'll need to get this from fileserver if needed
            mimeType: getMimeType(file.filename),
            filePath: file.url,
          }))
        } : undefined,
      },
      include: {
        creator: true,
        attachments: true,
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

