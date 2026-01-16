"use client"

import { useIdleTimeout } from "@/hooks/use-idle-timeout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export function IdleTimeoutProvider() {
  const { showWarning, timeRemaining, handleStayLoggedIn, handleLogoutNow } = useIdleTimeout()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl">Session Timeout Warning</DialogTitle>
              <DialogDescription className="text-sm sm:text-base mt-1">
                Your session will expire soon due to inactivity
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm sm:text-base text-muted-foreground mb-4">
            You have been inactive for a while. Your session will be logged out in:
          </p>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                {timeRemaining !== null ? formatTime(timeRemaining) : "0:00"}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {timeRemaining !== null && timeRemaining > 60 ? "minutes" : "seconds"} remaining
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleLogoutNow}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Logout Now
          </Button>
          <Button
            onClick={handleStayLoggedIn}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

