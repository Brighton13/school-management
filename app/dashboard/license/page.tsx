"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type LicenseStatus = {
  state: "ACTIVE" | "GRACE" | "EXPIRED" | "MISSING" | "OVER_LIMIT" | "INVALID"
  message: string
  activeStudentCount: number
  daysUntilExpiry: number | null
  estimatedAmount: number
  license: null | {
    id: string
    licenseId: string
    customerName: string
    schoolName: string
    planName: string
    status: string
    startsAt: string
    expiresAt: string
    maxStudents: number
    billingModel: string
    perStudentRate: number
    flatRate: number | null
    currency: string
    graceDays: number
    events: Array<{ id: string; type: string; message: string | null; createdAt: string }>
    billingSnapshots: Array<{
      id: string
      activeStudentCount: number
      estimatedAmount: number
      currency: string
      capturedAt: string
    }>
  }
}

const stateTone: Record<LicenseStatus["state"], string> = {
  ACTIVE: "bg-green-100 text-green-800",
  GRACE: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-red-100 text-red-800",
  MISSING: "bg-slate-100 text-slate-800",
  OVER_LIMIT: "bg-red-100 text-red-800",
  INVALID: "bg-red-100 text-red-800",
}

export default function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/license/status", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load license")
      setStatus(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const installLicense = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/license/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to install license")
      toast({ title: "License installed", description: "The subscription has been updated." })
      setLicenseKey("")
      await fetchStatus()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const money = (amount: number, currency = status?.license?.currency || "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)

  const license = status?.license
  const blocking = status && ["MISSING", "EXPIRED", "OVER_LIMIT", "INVALID"].includes(status.state)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription License</h1>
          <p className="text-muted-foreground">Manage renewal, student limits, and billing for this school instance.</p>
        </div>
        <Button variant="outline" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {status && (
        <Alert variant={blocking ? "destructive" : "default"}>
          {blocking ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>{status.state.replace("_", " ")}</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle>
              <Badge className={status ? stateTone[status.state] : ""}>{status?.state || "Loading"}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Students</CardDescription>
            <CardTitle>{status?.activeStudentCount ?? 0} / {license?.maxStudents ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expiry</CardDescription>
            <CardTitle>{license ? new Date(license.expiresAt).toLocaleDateString() : "No license"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Bill</CardDescription>
            <CardTitle>{status ? money(status.estimatedAmount) : money(0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Current License</CardTitle>
            <CardDescription>Renewal keys replace or extend the installed license.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {license ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><span className="text-sm text-muted-foreground">Customer</span><p className="font-medium">{license.customerName}</p></div>
                <div><span className="text-sm text-muted-foreground">School</span><p className="font-medium">{license.schoolName}</p></div>
                <div><span className="text-sm text-muted-foreground">Plan</span><p className="font-medium">{license.planName}</p></div>
                <div><span className="text-sm text-muted-foreground">Billing</span><p className="font-medium">{license.billingModel.replace("_", " ")}</p></div>
                <div><span className="text-sm text-muted-foreground">Per Student</span><p className="font-medium">{money(license.perStudentRate, license.currency)}</p></div>
                <div><span className="text-sm text-muted-foreground">Grace Period</span><p className="font-medium">{license.graceDays} days</p></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Install a license key generated by the license portal to activate the system.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Install Renewal Key</CardTitle>
            <CardDescription>Paste the signed license key issued from the license generator app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="licenseKey">License Key</Label>
            <Textarea
              id="licenseKey"
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              rows={7}
              placeholder="Paste signed license key"
            />
            <Button className="w-full" onClick={installLicense} disabled={saving || !licenseKey.trim()}>
              {saving ? "Installing..." : "Install License"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>License Activity</CardTitle>
          <CardDescription>Recent installation, verification, and billing events.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(license?.events || []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{event.type}</TableCell>
                  <TableCell>{event.message || "-"}</TableCell>
                </TableRow>
              ))}
              {!license?.events?.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">No license activity yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
