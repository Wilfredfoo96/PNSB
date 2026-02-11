'use client'

import { useUser } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserRole } from '@/lib/permissions'

/**
 * Hook to get the current user's role from Convex
 */
export function useUserRole(): UserRole | null {
  const { user } = useUser()
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : 'skip'
  )

  return (convexUser?.role as UserRole | undefined) || null
}
