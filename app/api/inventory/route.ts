import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(items)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "LIBRARIAN"].includes(session.user.role)) {
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

