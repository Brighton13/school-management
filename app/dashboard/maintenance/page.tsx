import { AlertTriangle, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MaintenancePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>System Under Maintenance</CardTitle>
          <CardDescription>
            Access is temporarily unavailable while the school system subscription is being renewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 p-3">
            <Clock className="h-4 w-4" />
            <span>Please try again later or contact your school administrator.</span>
          </div>
          <p>
            Your login is valid, but normal system features are paused until the administrator completes the license renewal.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
