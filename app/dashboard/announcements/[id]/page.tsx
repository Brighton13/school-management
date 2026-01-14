"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Calendar, User, Clock, FileText, Upload, Download, Trash2, Paperclip } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useSession } from "next-auth/react"

interface AnnouncementAttachment {
  id: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  filePath: string
  createdAt: string
}

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  targetAudience: string
  targetClassId: string | null
  targetSectionId: string | null
  published: boolean
  publishedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
    email: string
  }
  attachments: AnnouncementAttachment[]
}

interface AnnouncementDetailPageProps {
  params: {
    id: string
  }
}

export default function AnnouncementDetailPage({ params }: AnnouncementDetailPageProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const canManage = session?.user.role === "ADMIN" || session?.user.role === "PRINCIPAL" || 
    (session?.user.role === "TEACHER" && announcement?.creator.id === session?.user.id)

  useEffect(() => {
    fetchAnnouncement()
  }, [params.id])

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch(`/api/announcements/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setAnnouncement(data)
      } else {
        console.error("Failed to fetch announcement")
      }
    } catch (error) {
      console.error("Failed to fetch announcement:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const file = formData.get("file") as File

      if (!file || file.size === 0) {
        alert("Please select a file to upload")
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append("file", file)

      const res = await fetch(`/api/announcements/${params.id}/attachments`, {
        method: "POST",
        body: uploadFormData,
      })

      if (res.ok) {
        setIsUploadDialogOpen(false)
        fetchAnnouncement() // Refresh to show new attachment
        const form = e.currentTarget
        form.reset()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to upload file")
      }
    } catch (error) {
      console.error("Failed to upload file:", error)
      alert("Failed to upload file")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) {
      return
    }

    try {
      const res = await fetch(`/api/announcements/${params.id}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchAnnouncement() // Refresh to remove deleted attachment
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to delete attachment")
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error)
      alert("Failed to delete attachment")
    }
  }

  const handleDownload = (attachment: AnnouncementAttachment) => {
    // Create a temporary link element and trigger download
    const link = document.createElement('a')
    link.href = attachment.filePath
    link.download = attachment.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'ACADEMIC':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'EVENT':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTargetAudienceColor = (audience: string) => {
    switch (audience) {
      case 'ALL':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'STUDENTS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'TEACHERS':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading announcement...</p>
        </div>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Announcement not found</h2>
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Announcement Details</h1>
          <p className="text-muted-foreground">View full announcement information and attachments</p>
        </div>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{announcement.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>By: {announcement.creator.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created: {formatDate(announcement.createdAt)}</span>
                </div>
                {announcement.publishedAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Published: {formatDate(announcement.publishedAt)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge className={getTypeColor(announcement.type)}>
                {announcement.type}
              </Badge>
              <Badge className={getTargetAudienceColor(announcement.targetAudience)}>
                {announcement.targetAudience}
              </Badge>
              <Badge variant={announcement.published ? "default" : "secondary"}>
                {announcement.published ? "Published" : "Draft"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <div className="whitespace-pre-wrap text-base leading-relaxed">
              {announcement.content}
            </div>
          </div>

          {announcement.expiresAt && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Expires: {formatDate(announcement.expiresAt)}</span>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments ({announcement.attachments.length})
              </h3>
              {canManage && (
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Attachment</DialogTitle>
                      <DialogDescription>
                        Add a file attachment to this announcement
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFileUpload}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="file">Select File</Label>
                          <Input
                            id="file"
                            name="file"
                            type="file"
                            className="mt-1"
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.ppt,.pptx"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, XLSX, PPT, etc.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsUploadDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={uploading}>
                          {uploading ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {announcement.attachments.length > 0 ? (
              <div className="space-y-3">
                {announcement.attachments.map((attachment) => (
                  <div 
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">{attachment.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)} • {formatDate(attachment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(attachment)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No attachments available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}