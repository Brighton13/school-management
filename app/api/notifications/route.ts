import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

// Error response helper
function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { 
      error: message, 
      data: [],
      notifications: [], 
      unreadCount: 0,
      pagination: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
        hasMore: false,
        hasPrevious: false,
      }
    },
    { status }
  )
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return errorResponse("Unauthorized", 401)
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const category = searchParams.get("category")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {
      userId: session.user.id,
    }

    if (unreadOnly) {
      whereClause.read = false
    }

    if (category) {
      whereClause.category = category
    }

    // Get total count
    const total = await prisma.notification.count({ where: whereClause })

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    })

    if (noPagination) {
      return NextResponse.json({
        notifications,
        unreadCount,
      })
    }

    return NextResponse.json({
      ...createPaginatedResponse(notifications, total, page, limit),
      unreadCount,
    })
  } catch (error: any) {
    console.error("Error fetching notifications:", error?.message || error)
    
    // Any database error should return empty state
    return errorResponse("Database error", 503)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds } = body

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { error: "Notification IDs are required" },
        { status: 400 }
      )
    }

    // Mark notifications as read
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    )
  }
}

