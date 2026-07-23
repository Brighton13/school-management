import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createPaginatedResponse, parseBoundedListLimit, parsePaginationParams } from "@/lib/pagination"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const search = searchParams.get("search")?.trim()
    const noPagination = searchParams.get("noPagination") === "true"
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const where: any = { isActive: true }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ]
    }

    const [total, departments] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        include: {
          _count: { select: { staff: true, subjects: true } },
        },
        orderBy: [{ name: "asc" }],
        ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
      }),
    ])

    if (noPagination) return NextResponse.json(departments)
    return NextResponse.json(createPaginatedResponse(departments, total, page, limit))
  } catch (error) {
    console.error("Failed to fetch departments:", error)
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}
