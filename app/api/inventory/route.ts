import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const lowStock = searchParams.get("lowStock") === "true"
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { supplier: { contains: search, mode: "insensitive" } },
      ]
    }
    if (category) {
      whereClause.category = category
    }
    // Filter items with low stock (quantity <= minStock)
    if (lowStock) {
      whereClause.AND = [
        { quantity: { lte: prisma.inventoryItem.fields.minStock } },
      ]
    }

    // Get total count
    const total = await prisma.inventoryItem.count({ where: whereClause })

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { name: "asc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(items)
    }

    return NextResponse.json(createPaginatedResponse(items, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.INVENTORY_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      category,
      quantity,
      unit,
      minStock,
      location,
      supplier,
      cost,
    } = body

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        quantity: parseInt(quantity),
        unit,
        minStock: minStock ? parseInt(minStock) : 0,
        location,
        supplier,
        cost: cost ? parseFloat(cost) : null,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "InventoryItem",
      request,
      {
        entityId: item.id,
        description: `Created inventory item: ${name} (${category}) - Quantity: ${quantity}`,
      }
    )

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create inventory item" },
      { status: 500 }
    )
  }
}

