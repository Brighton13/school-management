"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Mail, Save, CheckCircle2, AlertCircle } from "lucide-react"

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  from: string
  configured: boolean
}

export default function EmailConfigPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<EmailConfig>({
    host: "",
    port: 587,
    secure: false,
    user: "",
    from: "",
    configured: false,
  })
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/email-config")
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (error) {
      console.error("Failed to fetch email config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setSaving(true)

    try {
      const res = await fetch("/api/email-config", {
        method: config.configured ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          password: password || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to save email configuration")
      } else {
        setMessage("Email configuration saved successfully!")
        setConfig(data.config)
        setPassword("")
        fetchConfig()
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Configuration</h1>
        <p className="text-muted-foreground">
          Configure SMTP settings for sending emails (password reset, notifications, etc.)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Settings
          </CardTitle>
          <CardDescription>
            Enter your email server credentials. Common providers:
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><strong>Gmail:</strong> smtp.gmail.com, Port: 587, Secure: false</li>
              <li><strong>Outlook:</strong> smtp-mail.outlook.com, Port: 587, Secure: false</li>
              <li><strong>Custom SMTP:</strong> Use your provider's settings</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{message}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host *</Label>
                <Input
                  id="host"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Email/Username *</Label>
              <Input
                id="user"
                type="email"
                value={config.user}
                onChange={(e) => setConfig({ ...config, user: e.target.value })}
                placeholder="your-email@gmail.com"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config.configured ? "Leave blank to keep current password" : "Enter password"}
                required={!config.configured}
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                For Gmail, use an App Password instead of your regular password.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">From Email Address *</Label>
              <Input
                id="from"
                type="email"
                value={config.from}
                onChange={(e) => setConfig({ ...config, from: e.target.value })}
                placeholder="noreply@yourschool.com"
                required
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                This is the email address that will appear as the sender.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="secure"
                checked={config.secure}
                onCheckedChange={(checked) => setConfig({ ...config, secure: checked })}
                disabled={saving}
              />
              <Label htmlFor="secure" className="cursor-pointer">
                Use secure connection (SSL/TLS)
              </Label>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {config.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Email is configured and ready to use</span>
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                <p><strong>Host:</strong> {config.host}</p>
                <p><strong>Port:</strong> {config.port}</p>
                <p><strong>User:</strong> {config.user}</p>
                <p><strong>From:</strong> {config.from}</p>
                <p><strong>Secure:</strong> {config.secure ? "Yes" : "No"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

