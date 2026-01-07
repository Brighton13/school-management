import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      )

      // Poll for new notifications every 2 seconds
      let lastCheck = new Date()
      const pollInterval = setInterval(async () => {
        try {
          const newNotifications = await prisma.notification.findMany({
            where: {
              userId: session.user.id,
              read: false,
              createdAt: {
                gt: lastCheck,
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          })

          if (newNotifications.length > 0) {
            for (const notification of newNotifications) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "notification", data: notification })}\n\n`
                )
              )
            }
            lastCheck = new Date()
          }
        } catch (error) {
          console.error("Error polling notifications:", error)
        }
      }, 2000)

      // Clean up on client disconnect
      if (request.signal) {
        request.signal.addEventListener("abort", () => {
          clearInterval(pollInterval)
          controller.close()
        })
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

