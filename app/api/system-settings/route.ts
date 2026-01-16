import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

// Get system settings
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SETTINGS_READ)
    
    // Only users with settings.read permission can view settings
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    let settings = await prisma.systemSettings.findFirst()

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          idleTimeoutMinutes: 30,
          warningBeforeLogoutMinutes: 5,
          isIdleTimeoutEnabled: true,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("Error fetching system settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch system settings" },
      { status: 500 }
    )
  }
}

// Update system settings
export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SETTINGS_UPDATE)
    
    // Only users with settings.update permission can update settings
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { idleTimeoutMinutes, warningBeforeLogoutMinutes, isIdleTimeoutEnabled } = body

    // Validate input
    if (idleTimeoutMinutes !== undefined && (idleTimeoutMinutes < 1 || idleTimeoutMinutes > 480)) {
      return NextResponse.json(
        { error: "Idle timeout must be between 1 and 480 minutes" },
        { status: 400 }
      )
    }

    if (warningBeforeLogoutMinutes !== undefined && (warningBeforeLogoutMinutes < 1 || warningBeforeLogoutMinutes >= idleTimeoutMinutes)) {
      return NextResponse.json(
        { error: "Warning time must be at least 1 minute and less than idle timeout" },
        { status: 400 }
      )
    }

    let settings = await prisma.systemSettings.findFirst()

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          idleTimeoutMinutes: idleTimeoutMinutes ?? 30,
          warningBeforeLogoutMinutes: warningBeforeLogoutMinutes ?? 5,
          isIdleTimeoutEnabled: isIdleTimeoutEnabled ?? true,
        },
      })
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          ...(idleTimeoutMinutes !== undefined && { idleTimeoutMinutes }),
          ...(warningBeforeLogoutMinutes !== undefined && { warningBeforeLogoutMinutes }),
          ...(isIdleTimeoutEnabled !== undefined && { isIdleTimeoutEnabled }),
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("Error updating system settings:", error)
    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 }
    )
  }
}

