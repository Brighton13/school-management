"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Megaphone, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  targetAudience: string
  published: boolean
  publishedAt: string | null
  expiresAt: string | null
  createdAt: string
  creator: {
    name: string
  }
}

interface AnnouncementsSectionProps {
  maxItems?: number
  showViewAll?: boolean
}

export function AnnouncementsSection({ maxItems = 5, showViewAll = true }: AnnouncementsSectionProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const response = await fetch(`/api/announcements?noPagination=true&limit=${maxItems}`)
        if (response.ok) {
          const data = await response.json()
          // Handle both array response and paginated response
          const announcementsArr = Array.isArray(data) ? data : (data.data || [])
          // Filter to only show published and non-expired
          const filtered = announcementsArr
            .filter((a: Announcement) => a.published)
            .filter((a: Announcement) => !a.expiresAt || new Date(a.expiresAt) >= new Date())
            .slice(0, maxItems)
          setAnnouncements(filtered)
          setError(null)
        } else if (response.status === 503) {
          // Database connection error
          setError("Database connection issue")
          setAnnouncements([])
        } else {
          setError("Failed to load announcements")
          setAnnouncements([])
        }
      } catch (err) {
        console.error("Error fetching announcements:", err)
        setError("Failed to load announcements")
        setAnnouncements([])
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [maxItems])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "URGENT":
        return "bg-red-100 text-red-800 border-red-200"
      case "ACADEMIC":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "EVENT":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-orange-600" />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-orange-600" />
              Announcements
            </CardTitle>
            <CardDescription className="text-sm">Latest updates and notifications</CardDescription>
          </div>
          {showViewAll && (
            <Link href="/dashboard/announcements">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/announcements/${announcement.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{announcement.title}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(
                        announcement.type
                      )}`}
                    >
                      {announcement.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-2 line-clamp-2">
                  {announcement.content}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>By: {announcement.creator.name}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {announcement.targetAudience}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">No announcements at this time.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
