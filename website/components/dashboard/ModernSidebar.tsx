'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserButton, useUser } from '@clerk/nextjs'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface NavigationItem {
  name: string
  href: string
  icon: string
  requiresPermission?: keyof ReturnType<typeof getPermissionsForRole>
}

const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { name: 'Delivery Orders', href: '/dashboard/delivery-orders', icon: 'local_shipping' },
  { name: 'Temporary Receipts', href: '/dashboard/temporary-receipts', icon: 'receipt_long' },
  { name: 'Customers', href: '/dashboard/customers', icon: 'group' },
  { name: 'Products', href: '/dashboard/products', icon: 'inventory_2' },
  { name: 'Stock Keeping', href: '/dashboard/stock-keeping', icon: 'inventory' },
  { name: 'Reports', href: '/dashboard/reports', icon: 'assessment' },
]

export function ModernSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check for dark mode preference
    const darkMode = document.documentElement.classList.contains('dark')
    setIsDark(darkMode)
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !isDark
    setIsDark(newDarkMode)
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  useEffect(() => {
    // Load theme from localStorage on mount
    const theme = localStorage.getItem('theme')
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    } else {
      document.documentElement.classList.remove('dark')
      setIsDark(false)
    }
  }, [])

  const visibleItems = navigationItems.filter((item) => {
    if (item.requiresPermission) {
      return permissions[item.requiresPermission]
    }
    return true
  })

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-6 sticky top-0 h-screen z-50">
      <div className="mb-6 px-4">
        <Link href="/dashboard" className="flex items-center justify-center">
          <Image
            src="/images/LOGO_PassionCare.png"
            alt="Passion Care Logo"
            width={320}
            height={80}
            className="h-auto w-full max-w-full object-contain"
            priority
          />
        </Link>
      </div>
      <nav className="flex flex-col gap-1 flex-1 px-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          )
        })}
        <div className="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
        {/* System/Settings Section */}
        {permissions.canAccessSettings && (
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings')
                ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="material-symbols-outlined text-xl shrink-0">settings</span>
            <span className="text-sm">Settings</span>
          </Link>
        )}
        {permissions.canAccessUsersManagement && (
          <Link
            href="/dashboard/users"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              pathname === '/dashboard/users' || pathname.startsWith('/dashboard/users')
                ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="material-symbols-outlined text-xl shrink-0">people</span>
            <span className="text-sm">Users</span>
          </Link>
        )}
        {permissions.canAccessDebugging && (
          <>
            <Link
              href="/dashboard/debugging/database-explorer"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                pathname === '/dashboard/debugging/database-explorer' || pathname.startsWith('/dashboard/debugging')
                  ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <span className="material-symbols-outlined text-xl shrink-0">storage</span>
              <span className="text-sm">DB Explorer</span>
            </Link>
            <Link
              href="/dashboard/debugging/database-schema"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                pathname === '/dashboard/debugging/database-schema'
                  ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <span className="material-symbols-outlined text-xl shrink-0">schema</span>
              <span className="text-sm">DB Schema</span>
            </Link>
            <Link
              href="/dashboard/debugging/linked-schema"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                pathname === '/dashboard/debugging/linked-schema'
                  ? 'text-[#1e40af] bg-blue-50 dark:bg-blue-900/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <span className="material-symbols-outlined text-xl shrink-0">link</span>
              <span className="text-sm">Linked Schema</span>
            </Link>
          </>
        )}
      </nav>
      <div className="mt-auto px-3">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 w-full px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-[#1e40af] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg mb-3"
        >
          <span className={cn('material-symbols-outlined text-xl shrink-0', isDark ? 'hidden' : '')}>dark_mode</span>
          <span className={cn('material-symbols-outlined text-xl shrink-0', isDark ? '' : 'hidden')}>light_mode</span>
          <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm shrink-0">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-full h-full',
                },
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.emailAddresses[0]?.emailAddress}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
