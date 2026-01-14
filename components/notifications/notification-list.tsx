"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, X, Trash2, Bell } from "lucide-react"
import { useNotifications } from "@/hooks/use-notifications"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  category: string | null
  read: boolean
  link: string | null
  createdAt: string
}

export function NotificationList() {
  const router = useRouter()
  const { notifications, markAsRead, deleteNotification, markAllAsRead } = useNotifications()
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasConnectionError, setHasConnectionError] = useState(false)

  useEffect(() => {
    setLocalNotifications(notifications)
    
    // Only set loading to false after we've received notifications (even if empty array)
    if (isLoading) {
      setIsLoading(false)
    }
  }, [notifications])

  // Separate effect for connection error checking
  useEffect(() => {
    // Only check for connection error after initial load and if we have no notifications
    if (!isLoading && notifications.length === 0) {
      const checkConnection = async () => {
        try {
          const res = await fetch("/api/notifications?limit=1")
          setHasConnectionError(!res.ok && res.status === 503)
        } catch {
          setHasConnectionError(true)
        }
      }
      checkConnection()
    } else if (notifications.length > 0) {
      setHasConnectionError(false)
    }
  }, [isLoading, notifications.length])

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await markAsRead(notification.id)
      }
      if (notification.link) {
        router.push(notification.link)
      }
    } catch (error) {
      console.error("Error handling notification click:", error)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return "bg-green-100 text-green-800 border-green-200"
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "ERROR":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  return (
    <div className="flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex gap-2">
          {notifications.filter((n) => !n.read).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
            <p>Loading notifications...</p>
          </div>
        ) : hasConnectionError ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50 text-amber-500" />
            <p className="font-medium">Connection Issue</p>
            <p className="text-sm mt-1">Unable to load notifications</p>
          </div>
        ) : localNotifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {localNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-accent cursor-pointer transition-colors ${
                  !notification.read ? "bg-blue-50/50" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(
                          notification.type
                        )}`}
                      >
                        {notification.type}
                      </span>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-1">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notification.id)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

