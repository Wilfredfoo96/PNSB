'use client'

import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { cn } from '@/lib/utils'

interface Branch {
  _id: Id<'branches'>
  branchName: string
  alias?: string
  doNumbering?: string
  trNumbering?: string
}

interface BranchTabsProps {
  selectedBranchId: Id<'branches'> | null
  onBranchChange: (branchId: Id<'branches'> | null) => void
  /** When set, only branches in this list are shown; no "All Branches" option. */
  restrictToBranchIds?: Id<'branches'>[] | null
  className?: string
}

export function BranchTabs({ selectedBranchId, onBranchChange, restrictToBranchIds, className }: BranchTabsProps) {
  const branches = useQuery(api.branches.getBranches)

  // Don't render until we have fresh data (branches is undefined while loading)
  if (branches === undefined) {
    return null
  }

  if (branches.length === 0) {
    return null
  }

  // For staff: only show branches they have access to
  const visibleBranches = useMemo(() => {
    const list = restrictToBranchIds && restrictToBranchIds.length > 0
      ? branches.filter((b: Branch) => restrictToBranchIds.includes(b._id))
      : [...branches]
    return list.sort((a: Branch, b: Branch) => {
      const nameA = (a.alias || a.branchName).toLowerCase()
      const nameB = (b.alias || b.branchName).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [branches, restrictToBranchIds])

  const showAllBranchesOption = !restrictToBranchIds || restrictToBranchIds.length === 0

  return (
    <div className={cn('flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-4 mb-6', className)}>
      {showAllBranchesOption && (
        <button
          onClick={() => onBranchChange(null)}
          className={cn(
            'px-4 py-2 rounded-t-lg font-medium text-sm transition-colors',
            selectedBranchId === null
              ? 'bg-[#1e40af] text-white border-b-2 border-[#1e40af]'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          )}
        >
          All Branches
        </button>
      )}
      {visibleBranches.map((branch: Branch) => {
        const isSelected = selectedBranchId === branch._id
        const displayName = branch.alias || branch.branchName

        return (
          <button
            key={branch._id}
            onClick={() => onBranchChange(branch._id)}
            className={cn(
              'px-4 py-2 rounded-t-lg font-medium text-sm transition-colors',
              isSelected
                ? 'bg-[#1e40af] text-white border-b-2 border-[#1e40af]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {displayName}
          </button>
        )
      })}
    </div>
  )
}
