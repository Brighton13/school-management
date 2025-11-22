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
    if (!session) return

    try {
      const res = await fetch("/api/notifications?unreadOnly=false&limit=50")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    fetchNotifications()

    // Set up Server-Sent Events for real-time notifications
    const eventSource = new EventSource("/api/notifications/stream")

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "notification") {
        const newNotification = data.data
        setNotifications((prev) => [newNotification, ...prev])
        setUnreadCount((prev) => prev + 1)
        setPlaySound(true)
        setTimeout(() => setPlaySound(false), 100)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (session) {
          fetchNotifications()
        }
      }, 5000)
    }

    // Poll for updates every 30 seconds as fallback
    const pollInterval = setInterval(fetchNotifications, 30000)

    return () => {
      eventSource.close()
      clearInterval(pollInterval)
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

