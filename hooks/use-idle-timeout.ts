"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { signOut } from "next-auth/react"

interface IdleTimeoutSettings {
  idleTimeoutMinutes: number
  warningBeforeLogoutMinutes: number
  isIdleTimeoutEnabled: boolean
}

export function useIdleTimeout() {
  const [settings, setSettings] = useState<IdleTimeoutSettings>({
    idleTimeoutMinutes: 30,
    warningBeforeLogoutMinutes: 5,
    isIdleTimeoutEnabled: true,
  })
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const isActiveRef = useRef(true)

  // Fetch settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/system-settings/idle-timeout")
        const data = await response.json()
        setSettings(data)
      } catch (error) {
        console.error("Failed to fetch idle timeout settings:", error)
      }
    }
    fetchSettings()
  }, [])

  // Handle user activity
  const resetTimer = useCallback(() => {
    if (!settings.isIdleTimeoutEnabled) return

    lastActivityRef.current = Date.now()
    setShowWarning(false)
    setTimeRemaining(null)

    // Clear existing timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    const idleTimeoutMs = settings.idleTimeoutMinutes * 60 * 1000
    const warningTimeoutMs = (settings.idleTimeoutMinutes - settings.warningBeforeLogoutMinutes) * 60 * 1000

    // Set warning timer
    if (warningTimeoutMs > 0) {
      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true)
        const remaining = settings.warningBeforeLogoutMinutes * 60
        setTimeRemaining(remaining)
        
        // Update countdown
        countdownIntervalRef.current = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev === null || prev <= 1) {
              // Time's up - logout immediately
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
              
              // Log session logout
              fetch("/api/session-logs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
              }).catch((error) => {
                console.error("Failed to log session logout:", error)
              })
              
              signOut({ callbackUrl: "/login?reason=idle_timeout" })
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }, warningTimeoutMs)
    }

    // Set logout timer
    idleTimerRef.current = setTimeout(async () => {
      // Log session logout
      try {
        await fetch("/api/session-logs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("Failed to log session logout:", error)
      }
      
      signOut({ callbackUrl: "/login?reason=idle_timeout" })
    }, idleTimeoutMs)
  }, [settings])

  // Set up activity listeners
  useEffect(() => {
    if (!settings.isIdleTimeoutEnabled) return

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ]

    const handleActivity = () => {
      if (isActiveRef.current) {
        resetTimer()
      }
    }

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true)
    })

    // Initial timer setup
    resetTimer()

    // Handle visibility change (tab focus/blur)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, pause timers
        isActiveRef.current = false
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = null
        }
        if (warningTimerRef.current) {
          clearTimeout(warningTimerRef.current)
          warningTimerRef.current = null
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
      } else {
        // Tab is visible, resume timers
        isActiveRef.current = true
        resetTimer()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [settings, resetTimer])

  const handleStayLoggedIn = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  const handleLogoutNow = useCallback(async () => {
    // Log session logout
    try {
      await fetch("/api/session-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("Failed to log session logout:", error)
    }
    
    signOut({ callbackUrl: "/login" })
  }, [])

  return {
    showWarning,
    timeRemaining,
    handleStayLoggedIn,
    handleLogoutNow,
  }
}

