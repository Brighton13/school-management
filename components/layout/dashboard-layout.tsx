import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { Sidebar } from "./sidebar-with-dropdowns"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { Header } from "./header"
import { IdleTimeoutProvider } from "@/components/idle-timeout/idle-timeout-provider"
import { SessionValidator } from "@/components/session-validator"
import { getLicenseStatus, isLicenseBlocking } from "@/lib/license"
import { ForcePasswordChange } from "@/components/force-password-change"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const pathname = headers().get("x-pathname") || ""
  const isLicensePage = pathname.startsWith("/dashboard/license")
  const isMaintenancePage = pathname.startsWith("/dashboard/maintenance")
  const canManageLicense = ["ADMIN", "PRINCIPAL"].includes(session.user.role)
  const licenseStatus = await getLicenseStatus()
  const licenseBlocked = isLicenseBlocking(licenseStatus.state)

  if (licenseBlocked && !isLicensePage && !isMaintenancePage) {
    redirect(
      canManageLicense
        ? `/dashboard/license?reason=${licenseStatus.state.toLowerCase()}`
        : `/dashboard/maintenance?reason=${licenseStatus.state.toLowerCase()}`
    )
  }

  if (licenseBlocked && isLicensePage && !canManageLicense) {
    redirect(`/dashboard/maintenance?reason=${licenseStatus.state.toLowerCase()}`)
  }

  if (licenseBlocked && isMaintenancePage && canManageLicense) {
    redirect(`/dashboard/license?reason=${licenseStatus.state.toLowerCase()}`)
  }

  if (!licenseBlocked && isMaintenancePage) {
    redirect("/dashboard")
  }

  if (session.user.mustChangePassword) {
    return <ForcePasswordChange />
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar userRole={session.user.role} userName={session.user.name} />
      </div>
      <main className="flex-1 overflow-y-auto min-w-0">
        <Header userName={session.user.name} userRole={session.user.role} />
        <SessionValidator>
          <div className="w-full p-3 sm:p-4 md:p-6">
            {children}
          </div>
          <IdleTimeoutProvider />
        </SessionValidator>
      </main>
    </div>
  )
}

