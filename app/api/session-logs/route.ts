import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

// Helper function to detect device type
function detectDeviceType(userAgent: string): string {
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    return "MOBILE"
  }
  if (/tablet|ipad/i.test(userAgent)) {
    return "TABLET"
  }
  return "DESKTOP"
}

// Helper function to detect browser
function detectBrowser(userAgent: string): string {
  if (userAgent.includes("Chrome")) return "Chrome"
  if (userAgent.includes("Firefox")) return "Firefox"
  if (userAgent.includes("Safari")) return "Safari"
  if (userAgent.includes("Edge")) return "Edge"
  if (userAgent.includes("Opera")) return "Opera"
  return "Unknown"
}

// Helper function to detect OS
function detectOS(userAgent: string): string {
  if (userAgent.includes("Windows")) return "Windows"
  if (userAgent.includes("Mac")) return "macOS"
  if (userAgent.includes("Linux")) return "Linux"
  if (userAgent.includes("Android")) return "Android"
  if (userAgent.includes("iOS")) return "iOS"
  return "Unknown"
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SESSION_LOGS_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const isActive = searchParams.get("isActive")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    const whereClause: any = {}
    if (userId) {
      whereClause.userId = userId
    }
    if (isActive !== null) {
      whereClause.isActive = isActive === "true"
    }
    if (startDate || endDate) {
      whereClause.loginAt = {}
      if (startDate) {
        whereClause.loginAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.loginAt.lte = new Date(endDate)
      }
    }

    const [sessionLogs, total] = await Promise.all([
      prisma.sessionLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { loginAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sessionLog.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: sessionLogs,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching session logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch session logs" },
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

    const userAgent = request.headers.get("user-agent") || "unknown"
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"

    // Close any existing active sessions for this user
    await prisma.sessionLog.updateMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      data: {
        isActive: false,
        logoutAt: new Date(),
      },
    })

    // Create new session log
    const sessionLog = await prisma.sessionLog.create({
      data: {
        userId: session.user.id,
        ipAddress,
        userAgent,
        deviceType: detectDeviceType(userAgent),
        browser: detectBrowser(userAgent),
        os: detectOS(userAgent),
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json(sessionLog, { status: 201 })
  } catch (error) {
    console.error("Error creating session log:", error)
    return NextResponse.json(
      { error: "Failed to create session log" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Close active session for current user
    const activeSession = await prisma.sessionLog.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: { loginAt: "desc" },
    })

    if (activeSession) {
      const logoutTime = new Date()
      const duration = Math.floor(
        (logoutTime.getTime() - activeSession.loginAt.getTime()) / 1000
      )

      await prisma.sessionLog.update({
        where: { id: activeSession.id },
        data: {
          isActive: false,
          logoutAt: logoutTime,
          duration,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating session log:", error)
    return NextResponse.json(
      { error: "Failed to update session log" },
      { status: 500 }
    )
  }
}

