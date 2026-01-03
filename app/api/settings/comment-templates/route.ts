import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

/**
 * GET - Get all comment templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const commentType = searchParams.get("commentType")

    const templates = await prisma.commentTemplate.findMany({
      where: {
        isActive: true,
        ...(commentType ? { commentType } : {}),
      },
      orderBy: { minPercentage: "desc" },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching comment templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch comment templates" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or update comment templates (bulk)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SETTINGS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { templates, commentType } = body

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: "Templates array is required" },
        { status: 400 }
      )
    }

    if (!commentType || !["CLASS_TEACHER", "PRINCIPAL"].includes(commentType)) {
      return NextResponse.json(
        { error: "commentType must be CLASS_TEACHER or PRINCIPAL" },
        { status: 400 }
      )
    }

    // Validate templates
    for (const template of templates) {
      if (template.minPercentage === undefined || 
          template.maxPercentage === undefined || 
          !template.comment) {
        return NextResponse.json(
          { error: "Each template must have minPercentage, maxPercentage, and comment" },
          { status: 400 }
        )
      }
    }

    // Delete existing templates and create new ones (transaction)
    await prisma.$transaction(async (tx) => {
      // Delete existing templates for this type
      await tx.commentTemplate.deleteMany({
        where: { commentType },
      })

      // Create new templates
      await tx.commentTemplate.createMany({
        data: templates.map((t: any) => ({
          minPercentage: t.minPercentage,
          maxPercentage: t.maxPercentage,
          comment: t.comment,
          commentType,
          isActive: true,
        })),
      })
    })

    const updatedTemplates = await prisma.commentTemplate.findMany({
      where: { commentType },
      orderBy: { minPercentage: "desc" },
    })

    return NextResponse.json({
      message: "Comment templates updated successfully",
      templates: updatedTemplates,
    })
  } catch (error) {
    console.error("Error updating comment templates:", error)
    return NextResponse.json(
      { error: "Failed to update comment templates" },
      { status: 500 }
    )
  }
}
