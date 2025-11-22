import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "./sidebar-with-dropdowns"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { Header } from "./header"
import { IdleTimeoutProvider } from "@/components/idle-timeout/idle-timeout-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar userRole={session.user.role} userName={session.user.name} />
      </div>
      <main className="flex-1 overflow-y-auto min-w-0">
        <Header userName={session.user.name} userRole={session.user.role} />
        <div className="w-full p-3 sm:p-4 md:p-6">
          {children}
        </div>
        <IdleTimeoutProvider />
      </main>
    </div>
  )
}

