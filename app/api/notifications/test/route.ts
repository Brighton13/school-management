import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"

// Test endpoint to create a notification for the current user
// DELETE THIS FILE IN PRODUCTION
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Test Notification] Creating test notification for user:", session.user.id, session.user.email)

    const notification = await createNotification({
      userId: session.user.id,
      title: "Test Notification",
      message: "This is a test notification to verify the notification system is working correctly.",
      type: "INFO",
      category: "SYSTEM",
      link: "/dashboard",
    })

    if (notification) {
      console.log("[Test Notification] Successfully created:", notification)
      return NextResponse.json({
        success: true,
        message: "Test notification created successfully",
        notification,
      })
    } else {
      console.log("[Test Notification] Failed to create notification")
      return NextResponse.json({
        success: false,
        message: "Failed to create notification - check server logs",
      }, { status: 500 })
    }
  } catch (error) {
    console.error("[Test Notification] Error:", error)
    return NextResponse.json(
      { error: "Failed to create test notification", details: String(error) },
      { status: 500 }
    )
  }
}
