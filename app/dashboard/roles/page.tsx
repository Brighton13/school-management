"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Shield, Users, Search } from "lucide-react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  _count: {
    users: number
    permissions: number
  }
}

interface Permission {
  id: string
  name: string
  description: string | null
  module: string
  action: string
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    fetchRoles()
    fetchPermissions()
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchRoles()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const queryString = buildPaginatedQuery({ search: searchTerm || undefined }, { page, limit })
      const response = await fetch(`/api/roles?${queryString}`)
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (response.ok) {
        const data = await response.json()
        const rolesArr = data.data || []
        setRoles(rolesArr)
        if (data.pagination) setPaginationInfo(data.pagination)
        setError(null)
      } else {
        const errorData = await response.json()
        const errorMsg = errorData.error || "Failed to fetch roles"
        console.error("Error fetching roles:", errorMsg)
        setError(errorMsg)
        setRoles([])
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
      setError("Failed to connect to server")
      setRoles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/permissions?noPagination=true")
      if (response.ok) {
        const data = await response.json()
        const permsArr = Array.isArray(data) ? data : (data.data || [])
        setPermissions(permsArr)
      } else {
        const errorData = await response.json()
        console.error("Error fetching permissions:", errorData)
        setPermissions([])
      }
    } catch (error) {
      console.error("Error fetching permissions:", error)
      setPermissions([])
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          permissionIds: selectedPermissions,
        }),
      })

      if (response.ok) {
        setIsDialogOpen(false)
        setFormData({ name: "", description: "" })
        setSelectedPermissions([])
        fetchRoles()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to create role")
      }
    } catch (error) {
      console.error("Error creating role:", error)
      alert("Failed to create role")
    }
  }

  const handleEdit = (role: Role) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      description: role.description || "",
    })
    // Fetch role permissions
    fetchRolePermissions(role.id)
    setIsEditDialogOpen(true)
  }

  const fetchRolePermissions = async (roleId: string) => {
    try {
      const response = await fetch(`/api/roles/${roleId}/permissions`)
      if (response.ok) {
        const data = await response.json()
        setSelectedPermissions(data.map((rp: any) => rp.permissionId))
      }
    } catch (error) {
      console.error("Error fetching role permissions:", error)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return

    try {
      const response = await fetch(`/api/roles/${selectedRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          permissionIds: selectedPermissions,
        }),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setSelectedRole(null)
        setFormData({ name: "", description: "" })
        setSelectedPermissions([])
        fetchRoles()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update role")
      }
    } catch (error) {
      console.error("Error updating role:", error)
      alert("Failed to update role")
    }
  }

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert("System roles cannot be deleted")
      return
    }

    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchRoles()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete role")
      }
    } catch (error) {
      console.error("Error deleting role:", error)
      alert("Failed to delete role")
    }
  }

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  const selectAllPermissions = () => {
    const allPermissionIds = permissions.map(p => p.id)
    setSelectedPermissions(allPermissionIds)
  }

  const deselectAllPermissions = () => {
    setSelectedPermissions([])
  }

  const groupedPermissions = (Array.isArray(permissions) ? permissions : []).reduce((acc, perm) => {
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
        message="You don't have permission to view roles. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <p className="text-red-800 dark:text-red-200">
              {error}. Please try refreshing the page or logging out and back in.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage roles with custom permissions
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new role and assign permissions to it.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Permissions</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllPermissions}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deselectAllPermissions}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-4">
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module}>
                        <h4 className="font-semibold mb-2 capitalize">{module}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded"
                              />
                              <span className="text-sm">
                                {perm.action}
                                {perm.description && (
                                  <span className="text-muted-foreground ml-1">
                                    - {perm.description}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Role</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>
            Manage roles and their assigned permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {role._count.users}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      {role._count.permissions}
                    </div>
                  </TableCell>
                  <TableCell>
                    {role.isSystem ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        System
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        Custom
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(role)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!role.isSystem && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paginationInfo.total > 0 && (
            <Pagination pagination={paginationInfo} onPageChange={setPage} onLimitChange={setLimit} />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role details and permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Role Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Permissions</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllPermissions}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAllPermissions}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-4">
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module}>
                      <h4 className="font-semibold mb-2 capitalize">{module}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {perm.action}
                              {perm.description && (
                                <span className="text-muted-foreground ml-1">
                                  - {perm.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

