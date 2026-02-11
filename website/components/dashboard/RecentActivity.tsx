'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface RecentActivityProps {
  overdueInvoices?: number
  pendingDeliveryOrders?: number
}

export function RecentActivity({ 
  overdueInvoices = 0, 
  pendingDeliveryOrders = 0 
}: RecentActivityProps) {
  const actionItems = []

  if (overdueInvoices > 0) {
    actionItems.push({
    id: 1,
      type: 'danger',
      message: `${overdueInvoices} Invoice${overdueInvoices > 1 ? 's' : ''} Overdue`,
      time: 'Requires immediate attention',
      icon: '⚠️',
      href: '/dashboard/invoices?status=Unpaid',
      color: '#DE350B',
      bgColor: '#FFEBE6',
    })
  }

  if (pendingDeliveryOrders > 0) {
    actionItems.push({
    id: 2,
      type: 'warning',
      message: `${pendingDeliveryOrders} Pending Delivery Order${pendingDeliveryOrders > 1 ? 's' : ''}`,
      time: 'Awaiting processing',
      icon: '📦',
      href: '/dashboard/delivery-orders?status=Pending',
      color: '#FF991F',
      bgColor: '#FFFAE6',
    })
  }

  if (actionItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16"
            style={{ color: '#A5ADBA' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-base font-semibold" style={{ color: '#172B4D' }}>
            All Caught Up!
          </h3>
          <p className="mt-1 text-sm" style={{ color: '#6B778C' }}>
            No action items at this time
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {actionItems.map((item) => (
        <Link key={item.id} href={item.href}>
          <div 
            className="flex items-center justify-between p-4 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            style={{ backgroundColor: item.bgColor }}
          >
            <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
                <span className="text-xl">{item.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
                <p 
                  className="text-sm font-semibold"
                  style={{ color: item.color }}
                >
                  {item.message}
            </p>
                <p className="text-xs mt-1" style={{ color: '#6B778C' }}>
                  {item.time}
            </p>
          </div>
        </div>
            <div className="flex-shrink-0 ml-3">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                style={{ 
                  borderColor: item.color,
                  color: item.color,
                }}
                onClick={(e) => {
                  e.preventDefault()
                  window.location.href = item.href
                }}
              >
                View
              </Button>
      </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
