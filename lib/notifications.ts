import { prisma } from "./prisma"

export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR"
export type NotificationCategory = 
  | "RESULT" 
  | "ANNOUNCEMENT" 
  | "FEE" 
  | "EXAM" 
  | "ENROLLMENT"
  | "SYSTEM"
  | "USER"
  | "OTHER"

interface CreateNotificationData {
  userId: string
  title: string
  message: string
  type: NotificationType
  category?: NotificationCategory
  link?: string
  metadata?: any
}

export async function createNotification(data: CreateNotificationData) {
  try {
    console.log("[Notification] Creating notification for user:", data.userId, "Title:", data.title)
    
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        category: data.category || "OTHER",
        link: data.link || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })

    console.log("[Notification] Successfully created notification:", notification.id)
    return notification
  } catch (error) {
    console.error("[Notification] Error creating notification:", error)
    // Don't throw - notifications shouldn't break main flow
    return null
  }
}

export async function createBulkNotifications(
  userIds: string[],
  data: Omit<CreateNotificationData, "userId">
) {
  try {
    console.log("[Notification] Creating bulk notifications for", userIds.length, "users")
    
    const notifications = await Promise.all(
      userIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            title: data.title,
            message: data.message,
            type: data.type,
            category: data.category || "OTHER",
            link: data.link || null,
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          },
        })
      )
    )

    console.log("[Notification] Successfully created", notifications.length, "notifications")
    return notifications
  } catch (error) {
    console.error("[Notification] Error creating bulk notifications:", error)
    return []
  }
}

