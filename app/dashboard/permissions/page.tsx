"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield } from "lucide-react"
import { PermissionDenied } from "@/components/ui/permission-denied"

interface Permission {
  id: string
  name: string
  description: string | null
  module: string
  action: string
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/permissions")
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setPermissions(data)
      }
    } catch (error) {
      console.error("Error fetching permissions:", error)
    } finally {
      setLoading(false)
    }
  }

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to view permissions. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permissions Reference</h1>
        <p className="text-muted-foreground mt-1">
          System permissions are predefined and managed by administrators. Select these permissions when creating and managing roles.
        </p>
      </div>

      <div className="grid gap-6">
        {Object.entries(groupedPermissions).map(([module, perms]) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {module.charAt(0).toUpperCase() + module.slice(1).replace(/_/g, ' ')}
              </CardTitle>
              <CardDescription>
                {perms.length} permission{perms.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission Name</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perms.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">
                        {permission.name}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-slate-100 rounded text-sm">
                          {permission.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {permission.description || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">ℹ️ About Permissions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Permissions are system-managed and defined during system initialization. This page displays all available permissions for reference.
          </p>
          <p>
            To assign permissions to users, create a role and select the permissions you want to assign to it. Then assign that role to users.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

