import type { Metadata } from 'next'
import { ModernSidebar } from '@/components/dashboard/ModernSidebar'

export const metadata: Metadata = {
  title: 'Dashboard | Clerk + Convex Login',
  description: 'Your personal dashboard',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 flex font-display">
      <ModernSidebar />
      <main className="flex-1 flex flex-col min-h-screen">
            {children}
        </main>
    </div>
  )
}
