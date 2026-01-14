"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Bell, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useSession } from "next-auth/react"

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  targetAudience: string
  published: boolean
  publishedAt: string | null
  expiresAt: string | null
  creator: {
    name: string
  }
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formType, setFormType] = useState("")
  const [formTargetAudience, setFormTargetAudience] = useState("")
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements?noPagination=true")
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      const announcementsArr = Array.isArray(data) ? data : (data.data || [])
      
      // Ensure data is an array
      if (Array.isArray(announcementsArr)) {
        setAnnouncements(announcementsArr)
      } else {
        console.error("Invalid data format:", data)
        setAnnouncements([])
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          content: formData.get("content"),
          type: formType || formData.get("type"),
          targetAudience: formTargetAudience || formData.get("targetAudience"),
          expiresAt: formData.get("expiresAt"),
          published: formData.get("published") === "on",
        }),
      })

      if (res.ok) {
        const form = e.currentTarget
        if (form) {
          form.reset()
        }
        setFormType("")
        setFormTargetAudience("")
        setIsDialogOpen(false)
        fetchAnnouncements()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to create announcement")
      }
    } catch (error) {
      console.error("Failed to create announcement:", error)
      alert("Failed to create announcement")
    }
  }

  const handleTogglePublish = async (announcementId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/announcements/${announcementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published: !currentStatus,
        }),
      })

      if (res.ok) {
        fetchAnnouncements()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to update announcement")
      }
    } catch (error) {
      console.error("Failed to toggle publish status:", error)
      alert("Failed to update announcement")
    }
  }

  const handleDelete = async (announcementId: string) => {
    if (!confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/announcements/${announcementId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchAnnouncements()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to delete announcement")
      }
    } catch (error) {
      console.error("Failed to delete announcement:", error)
      alert("Failed to delete announcement")
    }
  }

  const canManage = session?.user.role === "ADMIN" || session?.user.role === "PRINCIPAL"
  const canCreate = ["ADMIN", "PRINCIPAL", "TEACHER"].includes(session?.user.role || "")

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to access this page. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Broadcast messages and announcements</p>
        </div>
        {canCreate && (
          <Dialog 
            open={isDialogOpen} 
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                setFormType("")
                setFormTargetAudience("")
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Announcement
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>
                Create a new announcement or broadcast message
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <textarea
                    id="content"
                    name="content"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select 
                      value={formType} 
                      onValueChange={setFormType}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="ACADEMIC">Academic</SelectItem>
                        <SelectItem value="EVENT">Event</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetAudience">Target Audience</Label>
                    <Select 
                      value={formTargetAudience} 
                      onValueChange={setFormTargetAudience}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="STUDENTS">Students</SelectItem>
                        <SelectItem value="PARENTS">Parents</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                  <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="published"
                    name="published"
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="published">Publish immediately</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Announcement</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No announcements found. Create your first announcement to get started.
          </div>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <div onClick={() => router.push(`/dashboard/announcements/${announcement.id}`)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        {canManage && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            announcement.published 
                              ? "bg-green-100 text-green-800" 
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {announcement.published ? "Published" : "Draft"}
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {announcement.creator.name} • {announcement.publishedAt && formatDate(announcement.publishedAt)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {announcement.content}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {announcement.type}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        {announcement.targetAudience}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </div>
              {canManage && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePublish(announcement.id, announcement.published)}
                      className={announcement.published ? "text-orange-600" : "text-green-600"}
                    >
                      {announcement.published ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Publish
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(announcement.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

