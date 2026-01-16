import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "LIBRARIAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all inventory items
    const items = await prisma.inventoryItem.findMany({
      include: {
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    })

    // Calculate inventory statistics
    const inventory = {
      totalItems: items.length,
      lowStockItems: items.filter((i) => i.quantity <= i.minStock && i.quantity > 0).length,
      outOfStockItems: items.filter((i) => i.quantity === 0).length,
      totalValue: items.reduce((sum, i) => sum + (i.quantity * (i.cost || 0)), 0),
    }

    // Items by category
    const itemsByCategoryMap = new Map<string, { count: number; value: number }>()
    items.forEach((item) => {
      if (!itemsByCategoryMap.has(item.category)) {
        itemsByCategoryMap.set(item.category, { count: 0, value: 0 })
      }
      const stats = itemsByCategoryMap.get(item.category)!
      stats.count += 1
      stats.value += item.quantity * (item.cost || 0)
    })

    const itemsByCategory = Array.from(itemsByCategoryMap.entries()).map(
      ([category, stats]) => ({
        category,
        count: stats.count,
        value: stats.value,
      })
    )

    // Low stock items
    const lowStockItems = items
      .filter((i) => i.quantity <= i.minStock)
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        minStock: i.minStock,
      }))

    // Recent transactions
    const recentTransactions = await prisma.inventoryTransaction.findMany({
      include: {
        item: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    })

    return NextResponse.json({
      inventory,
      itemsByCategory,
      lowStockItems,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        itemName: t.item.name,
        type: t.type,
        quantity: t.quantity,
        date: t.createdAt,
      })),
    })
  } catch (error) {
    console.error("Librarian analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch librarian analytics" },
      { status: 500 }
    )
  }
}

