"use client"

import { useEffect, useState, useRef } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NotificationList } from "./notification-list"
import { NotificationErrorBoundary } from "./notification-error-boundary"
import { useNotifications } from "@/hooks/use-notifications"

export function NotificationBell() {
  const { unreadCount, playSound } = useNotifications()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Create audio element for notification sound using Web Audio API
    if (typeof window !== "undefined") {
      const playBeep = async () => {
        try {
          // Check if AudioContext is supported
          if (!window.AudioContext && !(window as any).webkitAudioContext) {
            console.warn("AudioContext not supported")
            return
          }

          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          
          // Resume audio context if it's suspended (required for Chrome)
          if (audioContext.state === 'suspended') {
            await audioContext.resume()
          }
          
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.value = 800
          oscillator.type = "sine"
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          
          // Clean up after playing
          setTimeout(() => {
            try {
              audioContext.close()
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 1000)
        } catch (error) {
          console.error("Error playing notification sound:", error)
          // Fallback: try to play a simple beep using the system
          try {
            // No valid fallback available
          } catch (e) {
            // Silent fallback
          }
        }
      }
      
      audioRef.current = { play: playBeep } as any
    }
  }, [])

  useEffect(() => {
    if (playSound && audioRef.current) {
      audioRef.current.play()
    }
  }, [playSound])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0" 
        align="end" 
        sideOffset={8}
        onOpenAutoFocus={(e) => {
          // Prevent focus from moving to the first element
          e.preventDefault()
        }}
      >
        <div className="max-h-[70vh] overflow-hidden">
          <NotificationErrorBoundary>
            <NotificationList />
          </NotificationErrorBoundary>
        </div>
      </PopoverContent>
    </Popover>
  )
}

