'use client'

import { useUserRole } from '@/hooks/useUserRole'
import { canAccessRoute } from '@/lib/permissions'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Hook to protect routes based on user role
 * Redirects to dashboard if user doesn't have access
 */
export function useRouteProtection() {
  const userRole = useUserRole()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (userRole !== null && !canAccessRoute(userRole, pathname)) {
      // User doesn't have access, redirect to dashboard
      router.push('/dashboard')
    }
  }, [userRole, pathname, router])
}
