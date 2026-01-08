"use client"

import { useState, useEffect } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SystemSettings {
  id: string
  idleTimeoutMinutes: number
  warningBeforeLogoutMinutes: number
  isIdleTimeoutEnabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/system-settings")
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      } else {
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)

    try {
      const response = await fetch("/api/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idleTimeoutMinutes: settings.idleTimeoutMinutes,
          warningBeforeLogoutMinutes: settings.warningBeforeLogoutMinutes,
          isIdleTimeoutEnabled: settings.isIdleTimeoutEnabled,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Settings saved successfully",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to save settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Configure system settings and permissions</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-destructive">Failed to load settings</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to access this page. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Configure system settings and permissions</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Session Timeout Settings</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Configure automatic logout for idle user sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="idle-timeout-enabled" className="text-sm sm:text-base">
                Enable Idle Timeout
              </Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Automatically log out users after a period of inactivity
              </p>
            </div>
            <Switch
              id="idle-timeout-enabled"
              checked={settings.isIdleTimeoutEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, isIdleTimeoutEnabled: checked })
              }
            />
          </div>

          {settings.isIdleTimeoutEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="idle-timeout" className="text-sm sm:text-base">
                  Idle Timeout (minutes)
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Time in minutes before an idle session is logged out (5-480 minutes)
                </p>
                <Input
                  id="idle-timeout"
                  type="number"
                  min="5"
                  max="480"
                  value={settings.idleTimeoutMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      idleTimeoutMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warning-timeout" className="text-sm sm:text-base">
                  Warning Before Logout (minutes)
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Show warning dialog this many minutes before logout (must be less than idle timeout)
                </p>
                <Input
                  id="warning-timeout"
                  type="number"
                  min="1"
                  max={settings.idleTimeoutMinutes - 1}
                  value={settings.warningBeforeLogoutMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      warningBeforeLogoutMinutes: parseInt(e.target.value) || 5,
                    })
                  }
                  className="max-w-xs"
                />
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

