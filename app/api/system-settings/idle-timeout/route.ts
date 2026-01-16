import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint to get idle timeout settings (for client-side use)
export async function GET() {
  try {
    let settings = await prisma.systemSettings.findFirst()

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        idleTimeoutMinutes: 30,
        warningBeforeLogoutMinutes: 5,
        isIdleTimeoutEnabled: true,
      })
    }

    return NextResponse.json({
      idleTimeoutMinutes: settings.idleTimeoutMinutes,
      warningBeforeLogoutMinutes: settings.warningBeforeLogoutMinutes,
      isIdleTimeoutEnabled: settings.isIdleTimeoutEnabled,
    })
  } catch (error: any) {
    console.error("Error fetching idle timeout settings:", error)
    // Return defaults on error
    return NextResponse.json({
      idleTimeoutMinutes: 30,
      warningBeforeLogoutMinutes: 5,
      isIdleTimeoutEnabled: true,
    })
  }
}

