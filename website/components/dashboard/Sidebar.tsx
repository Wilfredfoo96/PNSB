'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UserButton, useUser, SignOutButton } from '@clerk/nextjs'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  submenu?: Array<{ name: string; href: string }>
  divider?: boolean
  groupHeader?: string
  requiresPermission?: keyof ReturnType<typeof getPermissionsForRole>
}

interface NavigationGroup {
  header?: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    items: [
  { name: 'Dashboard', href: '/dashboard', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ) },
    ]
  },
  {
    header: 'OPERATIONS',
    items: [
  { name: 'Delivery Orders', href: '/dashboard/delivery-orders', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ) },
  { name: 'Temporary Receipts', href: '/dashboard/temporary-receipts', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) },
      { name: 'Customers', href: '/dashboard/customers', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ) },
    ]
  },
  {
    header: 'PRODUCTS',
    items: [
      { name: 'Products', href: '/dashboard/products', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ) },
      { name: 'Stock Keeping', href: '/dashboard/stock-keeping', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ) },
    ]
  },
  {
    header: 'SYSTEM',
    items: [
      { 
        name: 'Settings', 
        href: '/dashboard/settings', 
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        requiresPermission: 'canAccessSettings'
      },
      { 
        name: 'Users Management', 
        href: '/dashboard/users', 
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        ),
        requiresPermission: 'canAccessUsersManagement'
      },
  { 
    name: 'Debugging', 
    href: '/dashboard/debugging/database-explorer', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    submenu: [
      { name: 'Database Explorer', href: '/dashboard/debugging/database-explorer' },
      { name: 'Database Schema', href: '/dashboard/debugging/database-schema' },
      { name: 'Linked Schema', href: '/dashboard/debugging/linked-schema' },
        ],
        requiresPermission: 'canAccessDebugging'
      },
    ]
  },
]

export function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const pathname = usePathname()
  const { user } = useUser()
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)

  return (
    <>
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50"
        >
          <span className="sr-only">Open sidebar</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex h-20 shrink-0 items-center justify-center px-4 py-3 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
            <Link href="/dashboard" className="flex items-center justify-center w-full transition-opacity hover:opacity-80">
              <Image
                src="/images/LOGO_PassionCare.png"
                alt="Passion Care Logo"
                width={320}
                height={80}
                className="h-auto w-full max-w-full object-cover"
                priority
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col px-6 pb-4">
            <ul role="list" className="flex flex-1 flex-col gap-y-6">
              {navigationGroups.map((group, groupIndex) => {
                // Filter items based on permissions
                const visibleItems = group.items.filter((item) => {
                  if (item.requiresPermission) {
                    return permissions[item.requiresPermission]
                  }
                  return true
                })
                
                // Don't render the group if no items are visible
                if (visibleItems.length === 0) {
                  return null
                }
                
                return (
                <li key={groupIndex}>
                  {group.header && (
                    <div className="px-2 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B778C' }}>
                        {group.header}
                      </h3>
                    </div>
                  )}
                <ul role="list" className="-mx-2 space-y-1">
                    {visibleItems.map((item) => {
                      
                    const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href))
                    const isHovered = hoveredItem === item.name
                    const showSubmenu = item.submenu && (isHovered || item.submenu.some(sub => pathname === sub.href))
                    
                    return (
                      <li 
                        key={item.name}
                        onMouseEnter={() => item.submenu && setHoveredItem(item.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="relative"
                      >
                      <Link
                        href={item.href}
                        className={cn(
                            isActive
                              ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                          <span className={cn(
                            isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                          )}>{item.icon}</span>
                        {item.name}
                        </Link>
                        {showSubmenu && item.submenu && (
                          <ul className="ml-8 mt-1 space-y-1">
                            {item.submenu.map((subItem) => (
                              <li key={subItem.name}>
                                <Link
                                  href={subItem.href}
                                  className={cn(
                                    pathname === subItem.href
                                      ? 'text-blue-600 font-semibold'
                                      : 'text-gray-600 hover:text-blue-600',
                                    'block px-2 py-1 text-sm leading-6 rounded-md'
                                  )}
                                >
                                  {subItem.name}
                      </Link>
                    </li>
                  ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
                )
              })}
              
              {/* User section */}
              <li className="mt-auto">
                <div className="flex items-center justify-between px-2 py-3">
                  <div className="flex items-center gap-x-3">
                    <UserButton 
                      appearance={{
                        elements: {
                          userButtonAvatarBox: 'w-8 h-8',
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-6 text-gray-900 truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs leading-5 text-gray-500 truncate">
                        {user?.emailAddresses[0]?.emailAddress}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 hover:bg-gray-50" title="Settings">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Button>
                    <SignOutButton>
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600 hover:bg-red-50" title="Sign out">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </Button>
                  </SignOutButton>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40" />
          <div className="fixed inset-y-0 left-0 z-50 w-full overflow-y-auto bg-white sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
              <Link href="/dashboard" className="flex items-center justify-center w-full transition-opacity hover:opacity-80" onClick={() => setSidebarOpen(false)}>
                <Image
                  src="/images/LOGO_PassionCare.png"
                  alt="Passion Care Logo"
                  width={280}
                  height={80}
                  className="h-auto w-full max-w-full object-cover"
                  priority
                />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="mt-6 flow-root px-6">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-4 py-6">
                  {navigationGroups.map((group, groupIndex) => {
                    // Filter items based on permissions
                    const visibleItems = group.items.filter((item) => {
                      if (item.requiresPermission) {
                        return permissions[item.requiresPermission]
                      }
                      return true
                    })
                    
                    // Don't render the group if no items are visible
                    if (visibleItems.length === 0) {
                      return null
                    }
                    
                    return (
                    <div key={groupIndex}>
                      {group.header && (
                        <div className="px-3 mb-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B778C' }}>
                            {group.header}
                          </h3>
                        </div>
                      )}
                      <div className="space-y-1">
                        {visibleItems.map((item) => {
                          
                    const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href))
                    const isHovered = hoveredItem === item.name
                    const showSubmenu = item.submenu && (isHovered || item.submenu.some(sub => pathname === sub.href))
                    
                    return (
                      <div 
                        key={item.name}
                        onMouseEnter={() => item.submenu && setHoveredItem(item.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                    <Link
                      href={item.href}
                      className={cn(
                            isActive
                                ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50',
                        'group flex gap-x-3 rounded-md px-3 py-2 text-base font-semibold leading-7'
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                            <span className={cn(
                              isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                            )}>{item.icon}</span>
                      {item.name}
                        </Link>
                        {showSubmenu && item.submenu && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.submenu.map((subItem) => (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                className={cn(
                                  pathname === subItem.href
                                    ? 'text-blue-600 font-semibold'
                                    : 'text-gray-600 hover:text-blue-600',
                                  'block px-3 py-2 text-base font-semibold leading-7 rounded-md'
                                )}
                                onClick={() => setSidebarOpen(false)}
                              >
                                {subItem.name}
                    </Link>
                  ))}
                          </div>
                        )}
                            </div>
                          )
                        })}
                      </div>
                      </div>
                    )
                  })}
                </div>
                <div className="py-6">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-x-3">
                      <UserButton 
                        appearance={{
                          elements: {
                            userButtonAvatarBox: 'w-8 h-8',
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-7 text-gray-900 truncate">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-sm leading-6 text-gray-500 truncate">
                          {user?.emailAddresses[0]?.emailAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 hover:bg-gray-50" title="Settings">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </Button>
                      <SignOutButton>
                        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600 hover:bg-red-50" title="Sign out">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </Button>
                    </SignOutButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
