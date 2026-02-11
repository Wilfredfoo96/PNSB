'use client'

import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionIcon?: string
}

export function PageHeader({ title, description, actionLabel, onAction, actionIcon }: PageHeaderProps) {
  return (
    <header className="p-8 pb-4 flex items-end justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-[#1e40af] hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
        >
          {actionIcon && <span className="material-symbols-outlined text-xl">{actionIcon}</span>}
          {actionLabel}
        </button>
      )}
    </header>
  )
}
