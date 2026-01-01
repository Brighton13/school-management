import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET - Get all remark templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    const templates = await prisma.remarkTemplate.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: { minPercentage: "desc" },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching remark templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch remark templates" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or update remark templates (bulk)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { templates } = body

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: "Templates array is required" },
        { status: 400 }
      )
    }

    // Validate templates
    for (const template of templates) {
      if (template.minPercentage === undefined || 
          template.maxPercentage === undefined || 
          !template.remark) {
        return NextResponse.json(
          { error: "Each template must have minPercentage, maxPercentage, and remark" },
          { status: 400 }
        )
      }
    }

    // Delete existing templates and create new ones (transaction)
    const category = templates[0]?.category || "SUBJECT"
    
    await prisma.$transaction(async (tx) => {
      // Delete existing templates for this category
      await tx.remarkTemplate.deleteMany({
        where: { category },
      })

      // Create new templates
      await tx.remarkTemplate.createMany({
        data: templates.map((t: any) => ({
          minPercentage: t.minPercentage,
          maxPercentage: t.maxPercentage,
          remark: t.remark,
          category: t.category || "SUBJECT",
          isActive: true,
        })),
      })
    })

    const updatedTemplates = await prisma.remarkTemplate.findMany({
      where: { category },
      orderBy: { minPercentage: "desc" },
    })

    return NextResponse.json({
      message: "Remark templates updated successfully",
      templates: updatedTemplates,
    })
  } catch (error) {
    console.error("Error updating remark templates:", error)
    return NextResponse.json(
      { error: "Failed to update remark templates" },
      { status: 500 }
    )
  }
}
