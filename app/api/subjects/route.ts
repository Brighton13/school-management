import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(subjects)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, description, type } = body

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        description,
        type,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Subject",
      request,
      {
        entityId: subject.id,
        description: `Created subject: ${name} (${code})`,
      }
    )

    return NextResponse.json(subject, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Subject code already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create subject" },
      { status: 500 }
    )
  }
}

