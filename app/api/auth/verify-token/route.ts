import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      )
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!resetToken) {
      return NextResponse.json(
        { valid: false, error: "Invalid verification link" },
        { status: 404 }
      )
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { valid: false, error: "This verification link has expired. Please contact your administrator for a new link." },
        { status: 400 }
      )
    }

    // Check if token has already been used
    if (resetToken.used) {
      return NextResponse.json(
        { valid: false, error: "This verification link has already been used." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: resetToken.user.email,
      name: resetToken.user.name,
    })
  } catch (error) {
    console.error("Token verification error:", error)
    return NextResponse.json(
      { valid: false, error: "Failed to verify token" },
      { status: 500 }
    )
  }
}
