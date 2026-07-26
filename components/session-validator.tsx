"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import { usePreventBackAfterLogout } from "@/hooks/use-secure-logout"

type SessionValidatorProps = {
  children?: ReactNode
}

type LicenseGateState = "checking" | "allowed" | "blocked"

export function SessionValidator({ children }: SessionValidatorProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [licenseGate, setLicenseGate] = useState<LicenseGateState>(
    pathname.startsWith("/dashboard") ? "checking" : "allowed"
  )
  
  // Prevent back navigation after logout
  usePreventBackAfterLogout()

  useEffect(() => {
    // If user is not authenticated and trying to access protected routes
    if (status === "unauthenticated" && pathname.startsWith('/dashboard')) {
      router.replace('/login')
    }
  }, [status, pathname, router])

  useEffect(() => {
    if (status !== "authenticated" || !pathname.startsWith("/dashboard")) {
      setLicenseGate("allowed")
      return
    }

    const controller = new AbortController()
    setLicenseGate("checking")

    async function enforceLicenseGate() {
      try {
        const response = await fetch("/api/license/status", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          setLicenseGate("blocked")
          return
        }

        const licenseStatus = await response.json()
        const state = licenseStatus?.state
        const isBlocked = ["MISSING", "EXPIRED", "OVER_LIMIT", "INVALID"].includes(state)
        const isLicensePage = pathname.startsWith("/dashboard/license")
        const isMaintenancePage = pathname.startsWith("/dashboard/maintenance")
        const canManageLicense = ["ADMIN", "PRINCIPAL"].includes(session?.user?.role || "")

        if (isBlocked && !isLicensePage && !isMaintenancePage) {
          setLicenseGate("blocked")
          router.replace(
            canManageLicense
              ? `/dashboard/license?reason=${String(state).toLowerCase()}`
              : `/dashboard/maintenance?reason=${String(state).toLowerCase()}`
          )
          return
        }

        if (isBlocked && isLicensePage && !canManageLicense) {
          setLicenseGate("blocked")
          router.replace(`/dashboard/maintenance?reason=${String(state).toLowerCase()}`)
          return
        }

        if (isBlocked && isMaintenancePage && canManageLicense) {
          setLicenseGate("blocked")
          router.replace(`/dashboard/license?reason=${String(state).toLowerCase()}`)
          return
        }

        if (!isBlocked && isMaintenancePage) {
          setLicenseGate("blocked")
          router.replace("/dashboard")
          return
        }

        setLicenseGate("allowed")
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to enforce license gate:", error)
          setLicenseGate("blocked")
        }
      }
    }

    enforceLicenseGate()

    return () => controller.abort()
  }, [status, pathname, router, session?.user?.role])

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
        ;[metaCache, metaPragma, metaExpires].forEach((meta) => {
          if (meta.parentNode) {
            meta.parentNode.removeChild(meta)
          }
        })
      }
    }
  }, [pathname])

  if (children && pathname.startsWith("/dashboard") && licenseGate !== "allowed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Checking license status...
      </div>
    )
  }

  return <>{children ?? null}</>
}
