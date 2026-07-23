import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getLicenseStatus } from "@/lib/license"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await getLicenseStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error("Failed to fetch license status:", error)
    return NextResponse.json({ error: "Failed to fetch license status" }, { status: 500 })
  }
}
