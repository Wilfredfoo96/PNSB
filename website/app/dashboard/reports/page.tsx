'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { BranchTabs } from '@/components/dashboard/BranchTabs'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

export default function ReportsPage() {
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)
  const [selectedBranchId, setSelectedBranchId] = useState<Id<'branches'> | null>(null)
  const branches = useQuery(api.branches.getBranches) || []

  // For Staff: Auto-select their branch
  const currentUser = useQuery(api.users.getUserByClerkId, { 
    clerkId: typeof window !== 'undefined' ? (window as any).__clerk_user_id || '' : '' 
  })

  // Show tabs only for Admin and Super Admin
  const showBranchTabs = permissions.canCreateBranch // Admin and Super Admin can create branches

  return (
    <>
      <PageHeader
        title="Reports"
        description="View and analyze delivery orders and temporary receipts."
      />
      <div className="px-8 pb-8 flex-1">
        {showBranchTabs && branches.length > 0 && (
          <BranchTabs
            selectedBranchId={selectedBranchId}
            onBranchChange={setSelectedBranchId}
          />
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Select a report to view detailed analytics and insights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">Reports coming soon</p>
                <p className="text-sm">
                  This section will contain various reports for delivery orders and temporary receipts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
