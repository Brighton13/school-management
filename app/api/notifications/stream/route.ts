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
      let isClosed = false
      let pollInterval: NodeJS.Timeout | null = null

      // Helper function to safely enqueue data
      const safeEnqueue = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data))
          } catch (error) {
            // Controller is already closed, mark as closed
            isClosed = true
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = null
            }
          }
        }
      }

      // Helper function to safely close the controller
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
          try {
            controller.close()
          } catch (error) {
            // Already closed, ignore
          }
        }
      }

      // Send initial connection message
      safeEnqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`)

      // Poll for new notifications every 5 seconds (reduced frequency)
      let lastCheck = new Date()
      pollInterval = setInterval(async () => {
        if (isClosed) {
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
          return
        }

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

          if (newNotifications.length > 0 && !isClosed) {
            for (const notification of newNotifications) {
              safeEnqueue(
                `data: ${JSON.stringify({ type: "notification", data: notification })}\n\n`
              )
            }
            lastCheck = new Date()
          }
        } catch (error: any) {
          console.error("Error polling notifications:", error)
          
          // If it's a database connection error, send error and close
          if (error.code === 'P1001') {
            safeEnqueue(
              `data: ${JSON.stringify({ type: "error", message: "Database connection lost" })}\n\n`
            )
            safeClose()
          }
        }
      }, 5000) // Increased to 5 seconds to reduce load

      // Clean up on client disconnect
      if (request.signal) {
        request.signal.addEventListener("abort", () => {
          safeClose()
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

