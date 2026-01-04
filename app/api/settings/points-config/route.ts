import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET - Get all points configurations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pointsConfig = await prisma.pointsConfig.findMany({
      where: { isActive: true },
      orderBy: { maxPercentage: "desc" },
    })

    return NextResponse.json(pointsConfig)
  } catch (error) {
    console.error("Error fetching points config:", error)
    return NextResponse.json(
      { error: "Failed to fetch points configuration" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new points configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { minPercentage, maxPercentage, points, description } = body

    // Validate input
    if (minPercentage === undefined || maxPercentage === undefined || points === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: minPercentage, maxPercentage, points" },
        { status: 400 }
      )
    }

    if (minPercentage < 0 || maxPercentage > 100 || minPercentage > maxPercentage) {
      return NextResponse.json(
        { error: "Invalid percentage range" },
        { status: 400 }
      )
    }

    if (points < 1) {
      return NextResponse.json(
        { error: "Points must be at least 1" },
        { status: 400 }
      )
    }

    // Check for overlapping ranges
    const overlapping = await prisma.pointsConfig.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            AND: [
              { minPercentage: { lte: minPercentage } },
              { maxPercentage: { gte: minPercentage } },
            ],
          },
          {
            AND: [
              { minPercentage: { lte: maxPercentage } },
              { maxPercentage: { gte: maxPercentage } },
            ],
          },
          {
            AND: [
              { minPercentage: { gte: minPercentage } },
              { maxPercentage: { lte: maxPercentage } },
            ],
          },
        ],
      },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: "This range overlaps with an existing configuration" },
        { status: 400 }
      )
    }

    const config = await prisma.pointsConfig.create({
      data: {
        minPercentage,
        maxPercentage,
        points,
        description,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error("Error creating points config:", error)
    return NextResponse.json(
      { error: "Failed to create points configuration" },
      { status: 500 }
    )
  }
}

/**
 * PUT - Bulk update/replace all points configurations
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { configs } = body

    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { error: "configs must be an array" },
        { status: 400 }
      )
    }

    // Validate all configs
    for (const config of configs) {
      if (config.minPercentage === undefined || config.maxPercentage === undefined || config.points === undefined) {
        return NextResponse.json(
          { error: "Each config must have minPercentage, maxPercentage, and points" },
          { status: 400 }
        )
      }
      if (config.minPercentage < 0 || config.maxPercentage > 100 || config.minPercentage > config.maxPercentage) {
        return NextResponse.json(
          { error: `Invalid percentage range: ${config.minPercentage}-${config.maxPercentage}` },
          { status: 400 }
        )
      }
    }

    // Sort configs by maxPercentage descending and check for overlaps
    const sortedConfigs = [...configs].sort((a, b) => b.maxPercentage - a.maxPercentage)
    for (let i = 0; i < sortedConfigs.length - 1; i++) {
      if (sortedConfigs[i].minPercentage <= sortedConfigs[i + 1].maxPercentage) {
        return NextResponse.json(
          { error: "Overlapping ranges detected" },
          { status: 400 }
        )
      }
    }

    // Delete all existing and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate all existing configs
      await tx.pointsConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })

      // Create new configs
      for (const config of configs) {
        await tx.pointsConfig.create({
          data: {
            minPercentage: config.minPercentage,
            maxPercentage: config.maxPercentage,
            points: config.points,
            description: config.description || null,
            isActive: true,
          },
        })
      }
    })

    // Fetch and return the new configs
    const newConfigs = await prisma.pointsConfig.findMany({
      where: { isActive: true },
      orderBy: { maxPercentage: "desc" },
    })

    return NextResponse.json(newConfigs)
  } catch (error) {
    console.error("Error updating points config:", error)
    return NextResponse.json(
      { error: "Failed to update points configuration" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a specific points configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      )
    }

    await prisma.pointsConfig.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Points configuration deleted successfully" })
  } catch (error) {
    console.error("Error deleting points config:", error)
    return NextResponse.json(
      { error: "Failed to delete points configuration" },
      { status: 500 }
    )
  }
}
