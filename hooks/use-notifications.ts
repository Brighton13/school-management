"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"

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

export function useNotifications() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [playSound, setPlaySound] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!session) {
      // Clear state when no session
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      const res = await fetch("/api/notifications?unreadOnly=false&limit=50")
      if (res.ok) {
        const data = await res.json()
        // Handle both paginated response (data.data) and non-paginated response (data.notifications)
        const notificationsList = data.data || data.notifications || []
        setNotifications(notificationsList)
        setUnreadCount(data.unreadCount ?? 0)
      } else if (res.status === 503) {
        // Database connection error - set empty state
        console.warn("Database connection lost, showing empty state")
        setNotifications([])
        setUnreadCount(0)
      } else if (res.status === 401) {
        // Unauthorized - clear state
        setNotifications([])
        setUnreadCount(0)
      } else {
        console.error("Failed to fetch notifications:", res.status)
        // Clear state on other errors too
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
      // Clear state on network errors
      setNotifications([])
      setUnreadCount(0)
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    fetchNotifications()

    let eventSource: EventSource | null = null
    let pollInterval: NodeJS.Timeout | null = null
    let isCleanedUp = false

    try {
      // Set up Server-Sent Events for real-time notifications
      eventSource = new EventSource("/api/notifications/stream")

      eventSource.onopen = () => {
        console.log("Notification stream connected")
      }

      eventSource.onmessage = (event) => {
        if (isCleanedUp) return
        
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === "notification") {
            const newNotification = data.data
            setNotifications((prev) => [newNotification, ...prev.slice(0, 49)]) // Keep max 50 notifications
            setUnreadCount((prev) => prev + 1)
            setPlaySound(true)
            setTimeout(() => {
              if (!isCleanedUp) {
                setPlaySound(false)
              }
            }, 100)
          } else if (data.type === "error") {
            console.warn("Notification stream error:", data.message)
            // Handle database connection errors gracefully
            if (data.message === "Database connection lost") {
              eventSource?.close()
              // Don't try to reconnect immediately for database errors
              console.log("Database connection lost, stopping notification stream")
            }
          }
        } catch (error) {
          console.error("Error parsing notification data:", error)
        }
      }

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error)
        eventSource?.close()
        
        // Reconnect after 5 seconds if not cleaned up
        if (!isCleanedUp) {
          setTimeout(() => {
            if (session && !isCleanedUp) {
              fetchNotifications()
            }
          }, 5000)
        }
      }

      // Poll for updates every 30 seconds as fallback
      pollInterval = setInterval(() => {
        if (!isCleanedUp) {
          fetchNotifications()
        }
      }, 30000)
    } catch (error) {
      console.error("Error setting up notification stream:", error)
      // Fallback to polling only
      pollInterval = setInterval(() => {
        if (!isCleanedUp) {
          fetchNotifications()
        }
      }, 10000)
    }

    return () => {
      isCleanedUp = true
      eventSource?.close()
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [session, fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      })

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter((n) => !n.read)
        .map((n) => n.id)

      if (unreadIds.length === 0) return

      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: unreadIds }),
      })

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Error marking all as read:", error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        const notification = notifications.find((n) => n.id === notificationId)
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error("Error deleting notification:", error)
    }
  }

  return {
    notifications,
    unreadCount,
    playSound,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  }
}

