import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET - Get user's signature or all signatures (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const signatureType = searchParams.get("signatureType")

    // If admin and requesting all, return all signatures
    if (["ADMIN", "PRINCIPAL"].includes(session.user.role) && !userId) {
      const signatures = await prisma.signature.findMany({
        where: signatureType ? { signatureType } : {},
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      })
      return NextResponse.json(signatures)
    }

    // Get specific user's signature
    const targetUserId = userId || session.user.id
    const signature = await prisma.signature.findUnique({
      where: { userId: targetUserId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json(signature)
  } catch (error) {
    console.error("Error fetching signature:", error)
    return NextResponse.json(
      { error: "Failed to fetch signature" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or update user's signature
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { signatureImage, signatureType, userId } = body

    if (!signatureImage) {
      return NextResponse.json(
        { error: "Signature image is required" },
        { status: 400 }
      )
    }

    // Determine target user (admin can update others)
    const targetUserId = 
      (["ADMIN", "PRINCIPAL"].includes(session.user.role) && userId) 
        ? userId 
        : session.user.id

    // Check if signature exists
    const existingSignature = await prisma.signature.findUnique({
      where: { userId: targetUserId },
    })

    let signature
    if (existingSignature) {
      signature = await prisma.signature.update({
        where: { userId: targetUserId },
        data: {
          signatureImage,
          signatureType: signatureType || existingSignature.signatureType,
        },
      })
    } else {
      signature = await prisma.signature.create({
        data: {
          userId: targetUserId,
          signatureImage,
          signatureType,
        },
      })
    }

    return NextResponse.json({
      message: "Signature saved successfully",
      signature,
    })
  } catch (error) {
    console.error("Error saving signature:", error)
    return NextResponse.json(
      { error: "Failed to save signature" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove user's signature
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    // Determine target user (admin can delete others)
    const targetUserId = 
      (["ADMIN", "PRINCIPAL"].includes(session.user.role) && userId) 
        ? userId 
        : session.user.id

    await prisma.signature.delete({
      where: { userId: targetUserId },
    })

    return NextResponse.json({ message: "Signature deleted successfully" })
  } catch (error) {
    console.error("Error deleting signature:", error)
    return NextResponse.json(
      { error: "Failed to delete signature" },
      { status: 500 }
    )
  }
}
