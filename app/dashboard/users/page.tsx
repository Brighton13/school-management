"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, Search, Filter, CheckCircle2, XCircle, Shield, UserCog } from "lucide-react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
  permissions: Array<{
    id: string
    permission: {
      id: string
      name: string
      module: string
      action: string
    }
    granted: boolean
  }>
  roles?: Array<{
    id: string
    role: {
      id: string
      name: string
      description: string | null
      permissions: Array<{
        id: string
        permission: {
          id: string
          name: string
          module: string
          action: string
        }
        granted: boolean
      }>
    }
  }>
  student?: {
    admissionNumber: string
  }
  staff?: {
    employeeId: string
    designation: string
  }
}

interface Permission {
  id: string
  name: string
  description: string | null
  module: string
  action: string
}

interface Role {
  id: string
  name: string
  description: string | null
  permissions?: Array<{
    id: string
    permission: {
      id: string
      name: string
      module: string
      action: string
    }
    granted: boolean
  }>
}

const MODULES = [
  "students",
  "staff",
  "classes",
  "sections",
  "subjects",
  "results",
  "fees",
  "attendance",
  "inventory",
  "announcements",
  "exams",
  "enrollment",
  "applications",
  "roles",
  "permissions",
  "users",
  "settings",
  "audit",
  "session_logs",
  "academic_years",
]

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Pagination state
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  // Form state
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formRole, setFormRole] = useState("")
  const [formIsActive, setFormIsActive] = useState(true)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [page, limit])

  // Refetch when search or filters change (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, roleFilter, statusFilter])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params: Record<string, string | undefined> = {
        search: searchTerm || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        isActive: statusFilter !== "all" ? statusFilter : undefined,
      }
      const queryString = buildPaginatedQuery(params, { page, limit })
      const res = await fetch(`/api/users?${queryString}`)
      
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      
      const data = await res.json()
      // Handle paginated response
      if (data.data && data.pagination) {
        setUsers(data.data)
        setPaginationInfo(data.pagination)
      } else {
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params: Record<string, string | undefined> = {
        search: searchTerm || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        isActive: statusFilter !== "all" ? statusFilter : undefined,
      }
      const queryString = buildPaginatedQuery(params, { page, limit })
      
      const [usersRes, rolesRes, permissionsRes] = await Promise.all([
        fetch(`/api/users?${queryString}`),
        fetch("/api/roles?includePermissions=true&noPagination=true"),
        fetch("/api/permissions?noPagination=true"),
      ])
      
      // Check for permission denied on users endpoint
      if (usersRes.status === 401 || usersRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      
      const usersData = await usersRes.json()
      const rolesData = await rolesRes.json()
      const permissionsData = await permissionsRes.json()
      
      // Handle paginated response for users
      if (usersData.data && usersData.pagination) {
        setUsers(usersData.data)
        setPaginationInfo(usersData.pagination)
      } else if (Array.isArray(usersData)) {
        setUsers(usersData)
      } else {
        console.error("Failed to fetch users:", usersData)
        setUsers([])
      }
      
      // Handle roles response (might be paginated or not)
      if (Array.isArray(rolesData)) {
        setRoles(rolesData)
      } else if (rolesData.data) {
        setRoles(rolesData.data)
      } else {
        console.error("Failed to fetch roles:", rolesData)
        setRoles([])
      }
      
      // Handle permissions response
      if (Array.isArray(permissionsData)) {
        setPermissions(permissionsData)
      } else if (permissionsData.data) {
        setPermissions(permissionsData.data)
      } else {
        console.error("Failed to fetch permissions:", permissionsData)
        setPermissions([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setUsers([])
      setRoles([])
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!formName || !formEmail || !formRole) {
      alert("Please fill in all required fields")
      return
    }

    if (!editingUser && !formPassword) {
      alert("Password is required for new users")
      return
    }

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users"
      const method = editingUser ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword || undefined,
          phone: formPhone || null,
          role: formRole,
          isActive: formIsActive,
          permissions: selectedPermissions,
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingUser(null)
        resetForm()
        fetchData()
        alert(editingUser ? "User updated successfully" : "User created successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to save user")
      }
    } catch (error) {
      console.error("Failed to save user:", error)
      alert("Failed to save user. Please try again.")
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPhone(user.phone || "")
    setFormRole(user.role)
    setFormIsActive(user.isActive)
    setFormPassword("")
    setSelectedPermissions(user.permissions.map((p) => p.permission.id))
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
        alert("User deleted successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to delete user")
      }
    } catch (error) {
      console.error("Failed to delete user:", error)
      alert("Failed to delete user. Please try again.")
    }
  }

  const resetForm = () => {
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormPhone("")
    setFormRole("")
    setFormIsActive(true)
    setSelectedPermissions([])
    setEditingUser(null)
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

  // Group permissions by module
  const groupedPermissions = (Array.isArray(permissions) ? permissions : []).reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = []
    }
    acc[permission.module].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  // Get all unique modules from permissions (dynamic)
  const allModules = Array.from(new Set([
    ...MODULES,
    ...Object.keys(groupedPermissions)
  ]))

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "bg-red-100 text-red-800",
      PRINCIPAL: "bg-purple-100 text-purple-800",
      TEACHER: "bg-blue-100 text-blue-800",
      ACCOUNTANT: "bg-green-100 text-green-800",
      LIBRARIAN: "bg-yellow-100 text-yellow-800",
      STUDENT: "bg-indigo-100 text-indigo-800",
      PARENT: "bg-pink-100 text-pink-800",
    }
    return colors[role] || "bg-gray-100 text-gray-800"
  }

  if (permissionDenied) {
    return (
      <PermissionDenied
        title="Access Denied"
        message="You don't have permission to manage users. Please contact your administrator if you need access to this feature."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and permissions
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          {/* <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger> */}
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account with a role. Permissions are inherited from the assigned role.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList>
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select value={formRole} onValueChange={setFormRole} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="isActive">Status</Label>
                      <Select
                        value={formIsActive ? "active" : "inactive"}
                        onValueChange={(value) => setFormIsActive(value === "active")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="permissions" className="space-y-4">
                  {formRole ? (
                    (() => {
                      const selectedRoleData = roles.find(r => r.name === formRole)
                      const rolePerms = selectedRoleData?.permissions || []
                      const rolePermsByModule = rolePerms.reduce((acc, rp) => {
                        if (rp.granted) {
                          const mod = rp.permission.module
                          if (!acc[mod]) acc[mod] = []
                          acc[mod].push({ ...rp.permission, description: null })
                        }
                        return acc
                      }, {} as Record<string, Permission[]>)
                      
                      return (
                        <div className="space-y-4">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                              <Shield className="inline h-4 w-4 mr-1" />
                              Permissions are inherited from the <strong>{formRole}</strong> role. 
                              To modify permissions, edit the role in Role Management.
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {rolePerms.filter(rp => rp.granted).length} permissions assigned via role
                          </div>
                          <div className="space-y-4 max-h-80 overflow-y-auto">
                            {Object.keys(rolePermsByModule).sort().map((module) => (
                              <div key={module} className="space-y-2">
                                <Label className="text-sm font-semibold capitalize">
                                  {module.replace(/_/g, ' ')}
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {rolePermsByModule[module].map((permission) => (
                                    <div
                                      key={permission.id}
                                      className="flex items-center space-x-2 p-2 border rounded bg-green-50 border-green-200"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      <span className="text-sm text-green-800">
                                        {permission.action}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {Object.keys(rolePermsByModule).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No permissions assigned to this role.
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a role first to see assigned permissions</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {filteredUsers.length} user(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // If user has roles, ONLY use permissions from roles (ignore direct permissions)
                          // If user has no roles, use direct permissions
                          const hasRoles = user.roles && user.roles.length > 0
                          const rolePermissions = new Set<string>()
                          
                          if (hasRoles) {
                            // Only count permissions from roles
                            user.roles!.forEach((userRole) => {
                              userRole.role.permissions.forEach((rp) => {
                                if (rp.granted) {
                                  rolePermissions.add(rp.permission.id)
                                }
                              })
                            })
                          } else {
                            // No roles assigned, use direct permissions
                            user.permissions.forEach((p) => {
                              if (p.granted) {
                                rolePermissions.add(p.permission.id)
                              }
                            })
                          }
                          
                          const totalCount = rolePermissions.size
                          
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border">
                                {totalCount} permission{totalCount !== 1 ? "s" : ""}
                              </span>
                              {hasRoles && (
                                <div className="text-xs text-muted-foreground">
                                  from {user.roles!.length} role{user.roles!.length !== 1 ? "s" : ""}
                                </div>
                              )}
                              {!hasRoles && user.permissions.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  direct assignment
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {user.id !== session?.user.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          {paginationInfo.total > 0 && (
            <Pagination
              pagination={paginationInfo}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role. Permissions are inherited from the assigned role.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList>
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Full Name *</Label>
                      <Input
                        id="edit-name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email *</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">
                        Password {editingUser ? "(leave blank to keep current)" : "*"}
                      </Label>
                      <Input
                        id="edit-password"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        required={!editingUser}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone</Label>
                      <Input
                        id="edit-phone"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-role">Role *</Label>
                      <Select value={formRole} onValueChange={setFormRole} required>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-isActive">Status</Label>
                      <Select
                        value={formIsActive ? "active" : "inactive"}
                        onValueChange={(value) => setFormIsActive(value === "active")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="permissions" className="space-y-4">
                  {formRole ? (
                    (() => {
                      const selectedRoleData = roles.find(r => r.name === formRole)
                      const rolePerms = selectedRoleData?.permissions || []
                      const rolePermsByModule = rolePerms.reduce((acc, rp) => {
                        if (rp.granted) {
                          const mod = rp.permission.module
                          if (!acc[mod]) acc[mod] = []
                          acc[mod].push({ ...rp.permission, description: null })
                        }
                        return acc
                      }, {} as Record<string, Permission[]>)
                      
                      return (
                        <div className="space-y-4">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                              <Shield className="inline h-4 w-4 mr-1" />
                              Permissions are inherited from the <strong>{formRole}</strong> role. 
                              To modify permissions, edit the role in Role Management.
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {rolePerms.filter(rp => rp.granted).length} permissions assigned via role
                          </div>
                          <div className="space-y-4 max-h-80 overflow-y-auto">
                            {Object.keys(rolePermsByModule).sort().map((module) => (
                              <div key={module} className="space-y-2">
                                <Label className="text-sm font-semibold capitalize">
                                  {module.replace(/_/g, ' ')}
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {rolePermsByModule[module].map((permission) => (
                                    <div
                                      key={permission.id}
                                      className="flex items-center space-x-2 p-2 border rounded bg-green-50 border-green-200"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      <span className="text-sm text-green-800">
                                        {permission.action}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {Object.keys(rolePermsByModule).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No permissions assigned to this role.
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a role first to see assigned permissions</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update User</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

