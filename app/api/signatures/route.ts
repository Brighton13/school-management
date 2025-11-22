import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const signatureType = searchParams.get("signatureType")

    // If userId is provided and it's the current user, return their signature
    // Otherwise, if signatureType is provided, return signatures of that type
    const where: any = {}
    if (userId) {
      where.userId = userId
    }
    if (signatureType) {
      where.signatureType = signatureType
    }
    // If no filters, return current user's signature
    if (!userId && !signatureType) {
      where.userId = session.user.id
    }

    const signatures = await prisma.signature.findMany({
      where,
      include: {
        user: true,
      },
    })

    return NextResponse.json(signatures)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch signatures" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const signatureType = formData.get("signatureType") as string
    const imageFile = formData.get("image") as File

    if (!signatureType || !imageFile) {
      return NextResponse.json(
        { error: "Signature type and image are required" },
        { status: 400 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const signatureImage = `data:${imageFile.type};base64,${base64}`

    const existingSignature = await prisma.signature.findUnique({
      where: { userId: session.user.id },
    })

    const signature = await prisma.signature.upsert({
      where: { userId: session.user.id },
      update: {
        signatureType,
        signatureImage,
      },
      create: {
        userId: session.user.id,
        signatureType,
        signatureImage,
      },
      include: {
        user: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      existingSignature ? "UPDATE" : "CREATE",
      "Signature",
      request,
      {
        entityId: signature.id,
        description: `${existingSignature ? "Updated" : "Created"} ${signatureType} signature`,
      }
    )

    return NextResponse.json(signature, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save signature" },
      { status: 500 }
    )
  }
}

