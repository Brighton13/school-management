"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { usePreventBackAfterLogout } from "@/hooks/use-secure-logout"

export function SessionValidator() {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  
  // Prevent back navigation after logout
  usePreventBackAfterLogout()

  useEffect(() => {
    // If user is not authenticated and trying to access protected routes
    if (status === "unauthenticated" && pathname.startsWith('/dashboard')) {
      router.replace('/login')
    }
  }, [status, pathname, router])

  useEffect(() => {
    // Add page visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === "unauthenticated") {
        // If page becomes visible and user is not authenticated, redirect to login
        router.replace('/login')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Add focus handler for additional security
    const handleFocus = () => {
      if (status === "unauthenticated" && pathname.startsWith('/dashboard')) {
        router.replace('/login')
      }
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [status, pathname, router])

  // Add cache control headers via meta tags for additional protection
  useEffect(() => {
    if (pathname.startsWith('/dashboard')) {
      // Prevent page caching
      const metaCache = document.createElement('meta')
      metaCache.httpEquiv = 'Cache-Control'
      metaCache.content = 'no-cache, no-store, must-revalidate'
      document.head.appendChild(metaCache)

      const metaPragma = document.createElement('meta')
      metaPragma.httpEquiv = 'Pragma'
      metaPragma.content = 'no-cache'
      document.head.appendChild(metaPragma)

      const metaExpires = document.createElement('meta')
      metaExpires.httpEquiv = 'Expires'
      metaExpires.content = '0'
      document.head.appendChild(metaExpires)

      return () => {
        document.head.removeChild(metaCache)
        document.head.removeChild(metaPragma) 
        document.head.removeChild(metaExpires)
      }
    }
  }, [pathname])

  return null
}