import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET - Get school configuration
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get or create default school config
    let config = await prisma.schoolConfig.findFirst()
    
    if (!config) {
      config = await prisma.schoolConfig.create({
        data: {
          schoolName: "School Name",
          ministryHeader: "MINISTRY OF EDUCATION",
        },
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching school config:", error)
    return NextResponse.json(
      { error: "Failed to fetch school configuration" },
      { status: 500 }
    )
  }
}

/**
 * POST - Update school configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      schoolName,
      schoolMotto,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      schoolLogo,
      ministryHeader,
      principalName,
      principalSignature,
      reportFooterText,
      nextTermDate,
    } = body

    // Get existing config or create new
    let config = await prisma.schoolConfig.findFirst()

    if (config) {
      config = await prisma.schoolConfig.update({
        where: { id: config.id },
        data: {
          schoolName,
          schoolMotto,
          schoolAddress,
          schoolPhone,
          schoolEmail,
          schoolLogo,
          ministryHeader,
          principalName,
          principalSignature,
          reportFooterText,
          nextTermDate: nextTermDate ? new Date(nextTermDate) : null,
        },
      })
    } else {
      config = await prisma.schoolConfig.create({
        data: {
          schoolName,
          schoolMotto,
          schoolAddress,
          schoolPhone,
          schoolEmail,
          schoolLogo,
          ministryHeader,
          principalName,
          principalSignature,
          reportFooterText,
          nextTermDate: nextTermDate ? new Date(nextTermDate) : null,
        },
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error updating school config:", error)
    return NextResponse.json(
      { error: "Failed to update school configuration" },
      { status: 500 }
    )
  }
}
