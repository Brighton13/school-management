import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Permissions, requirePermission } from "@/lib/permissions"
import { ensureDefaultPromotionStreams, getPromotionStreams } from "@/lib/promotion-streams"
import { logAuditTrail } from "@/lib/audit"

interface PromotionStreamRow {
  classId: string
  streamName: string
  sequence: number
  isGraduationPoint: boolean
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.PROMOTIONS_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDefaultPromotionStreams()
    const [streams, classes] = await Promise.all([
      getPromotionStreams(),
      prisma.class.findMany({ orderBy: { level: "asc" } }),
    ])

    return NextResponse.json({ streams, classes })
  } catch (error) {
    console.error("Failed to fetch promotion streams:", error)
    return NextResponse.json({ error: "Failed to fetch promotion streams" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.PROMOTIONS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const rows: PromotionStreamRow[] = body.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "At least one promotion stream row is required" }, { status: 400 })
    }

    const classIds = rows.map((row) => row.classId)
    if (new Set(classIds).size !== classIds.length) {
      return NextResponse.json({ error: "Each class can only appear once in promotion stream rules" }, { status: 400 })
    }

    for (const row of rows) {
      if (!row.classId || !row.streamName?.trim()) {
        return NextResponse.json({ error: "Each row must include a class and stream name" }, { status: 400 })
      }
      if (!Number.isInteger(Number(row.sequence)) || Number(row.sequence) < 1) {
        return NextResponse.json({ error: "Each row must include a positive sequence number" }, { status: 400 })
      }
    }

    const grouped = new Map<string, PromotionStreamRow[]>()
    for (const row of rows) {
      const streamName = row.streamName.trim()
      if (!grouped.has(streamName)) grouped.set(streamName, [])
      grouped.get(streamName)!.push({ ...row, streamName, sequence: Number(row.sequence) })
    }

    for (const [streamName, streamRows] of Array.from(grouped.entries())) {
      const sequenceSet = new Set(streamRows.map((row) => row.sequence))
      if (sequenceSet.size !== streamRows.length) {
        return NextResponse.json({ error: `${streamName} has duplicate sequence numbers` }, { status: 400 })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.promotionStreamLevel.deleteMany()

      let displayOrder = 1
      for (const [streamName, streamRows] of Array.from(grouped.entries())) {
        const stream = await tx.promotionStream.upsert({
          where: { name: streamName },
          update: { isActive: true, displayOrder },
          create: { name: streamName, isActive: true, displayOrder },
        })

        for (const row of streamRows) {
          await tx.promotionStreamLevel.create({
            data: {
              streamId: stream.id,
              classId: row.classId,
              sequence: row.sequence,
              isGraduationPoint: Boolean(row.isGraduationPoint),
            },
          })
        }

        displayOrder++
      }
    })

    await logAuditTrail(session.user.id, "UPDATE", "PromotionStream", request, {
      description: `Updated promotion stream rules for ${rows.length} classes`,
      metadata: { streamCount: grouped.size, classCount: rows.length },
    })

    return NextResponse.json({ streams: await getPromotionStreams() })
  } catch (error) {
    console.error("Failed to update promotion streams:", error)
    return NextResponse.json({ error: "Failed to update promotion streams" }, { status: 500 })
  }
}
