import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

/**
 * POST - Create or update comment configuration for a teacher
 * Teachers configure comments based on marks ranges
 * Example: 0-40 marks = "Needs Improvement", 40-60 = "Satisfactory", etc.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.REPORTS_COMMENTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, marksLowerBound, marksUpperBound, commentTemplate, performanceArea } = body

    if (!sectionId || marksLowerBound === null || marksUpperBound === null || !commentTemplate) {
      return NextResponse.json(
        { error: "Missing required fields: sectionId, marksLowerBound, marksUpperBound, commentTemplate" },
        { status: 400 }
      )
    }

    if (marksLowerBound < 0 || marksUpperBound > 100 || marksLowerBound >= marksUpperBound) {
      return NextResponse.json(
        { error: "Invalid marks range. Must be 0-100 and lowerBound < upperBound" },
        { status: 400 }
      )
    }

    // Verify teacher is assigned to this section
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          where: { id: sectionId }
        }
      }
    })

    if (!staff || staff.sections.length === 0) {
      return NextResponse.json(
        { error: "You are not assigned to this section" },
        { status: 403 }
      )
    }

    // Check for existing config with same marks range
    const existingConfig = await prisma.reportCommentConfig.findFirst({
      where: {
        teacherId: staff.id,
        sectionId,
        marksLowerBound,
        marksUpperBound,
        performanceArea: performanceArea || "OVERALL"
      }
    })

    let config

    if (existingConfig) {
      // Update existing config
      config = await prisma.reportCommentConfig.update({
        where: { id: existingConfig.id },
        data: {
          commentTemplate,
          isActive: true
        },
        include: {
          teacher: { include: { user: true } },
          section: { include: { class: true } }
        }
      })
    } else {
      // Create new config
      config = await prisma.reportCommentConfig.create({
        data: {
          teacherId: staff.id,
          sectionId,
          marksLowerBound,
          marksUpperBound,
          commentTemplate,
          performanceArea: performanceArea || "OVERALL",
          isActive: true
        },
        include: {
          teacher: { include: { user: true } },
          section: { include: { class: true } }
        }
      })
    }

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      existingConfig ? "UPDATE" : "CREATE",
      "ReportCommentConfig",
      request,
      {
        entityId: config.id,
        description: `${existingConfig ? "Updated" : "Created"} comment template for ${config.section.name} (${config.marksLowerBound}-${config.marksUpperBound} marks)`
      }
    )

    return NextResponse.json(config, { status: existingConfig ? 200 : 201 })
  } catch (error) {
    console.error("Comment config error:", error)
    return NextResponse.json(
      { error: "Failed to save comment configuration" },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve comment configurations
 * Teachers see their own configurations for their sections
 * Admins/Principals can see all configurations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get("sectionId")

    let whereClause: any = {}

    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      })

      if (!staff) {
        return NextResponse.json([])
      }

      whereClause.teacherId = staff.id
    }

    if (sectionId) whereClause.sectionId = sectionId

    const configs = await prisma.reportCommentConfig.findMany({
      where: whereClause,
      include: {
        teacher: { include: { user: true } },
        section: { include: { class: true } }
      },
      orderBy: [{ sectionId: "asc" }, { marksLowerBound: "asc" }]
    })

    // Group by section for easier display
    const grouped = new Map()
    configs.forEach(config => {
      if (!grouped.has(config.sectionId)) {
        grouped.set(config.sectionId, {
          section: config.section,
          configs: []
        })
      }
      grouped.get(config.sectionId).configs.push(config)
    })

    return NextResponse.json(Array.from(grouped.values()))
  } catch (error) {
    console.error("Fetch comment configs error:", error)
    return NextResponse.json(
      { error: "Failed to fetch comment configurations" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a comment configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.REPORTS_COMMENTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const configId = searchParams.get("id")

    if (!configId) {
      return NextResponse.json(
        { error: "Missing configId parameter" },
        { status: 400 }
      )
    }

    // Verify ownership
    const config = await prisma.reportCommentConfig.findUnique({
      where: { id: configId },
      include: { teacher: { select: { userId: true } } }
    })

    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      )
    }

    if (config.teacher.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this configuration" },
        { status: 403 }
      )
    }

    await prisma.reportCommentConfig.delete({
      where: { id: configId }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "ReportCommentConfig",
      request,
      {
        entityId: configId,
        description: `Deleted comment template`
      }
    )

    return NextResponse.json(
      { message: "Configuration deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete comment config error:", error)
    return NextResponse.json(
      { error: "Failed to delete configuration" },
      { status: 500 }
    )
  }
}
