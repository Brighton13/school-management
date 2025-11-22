"use client"

import { Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { useState } from "react"
import { Sidebar } from "./sidebar-with-dropdowns"

interface HeaderProps {
  userName: string
  userRole: string
}

export function Header({ userName, userRole }: HeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Desktop spacer */}
          <div className="hidden lg:flex flex-1" />

          {/* User info and notifications */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User name - shown on sm and up, with icon on mobile */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md bg-muted/50">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[100px] sm:max-w-[200px]">
                {userName}
              </span>
            </div>
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <div className="h-full w-64 bg-card border-r shadow-lg">
              <Sidebar userRole={userRole} userName={userName} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

