"use client"

import { ShieldX, ArrowLeft, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface PermissionDeniedProps {
  title?: string
  message?: string
  showBackButton?: boolean
  showHomeButton?: boolean
}

export function PermissionDenied({
  title = "Access Denied",
  message = "You don't have permission to access this page. Please contact your administrator if you believe this is an error.",
  showBackButton = true,
  showHomeButton = true,
}: PermissionDeniedProps) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-4">
          {showBackButton && (
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          )}
          {showHomeButton && (
            <Button onClick={() => router.push("/dashboard")}>
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PermissionDeniedInline({
  message = "You don't have permission to view this content.",
}: {
  message?: string
}) {
  return (
    <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-3 text-muted-foreground">
        <ShieldX className="h-5 w-5" />
        <span>{message}</span>
      </div>
    </div>
  )
}
