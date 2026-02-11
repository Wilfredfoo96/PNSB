'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Overview } from '@/components/dashboard/Overview'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/PageHeader'

interface DashboardStats {
  cashOnHand: number
  accountsReceivable: number
  accountsPayable: number
  netProfit: number
  overdueInvoices: number
  pendingDeliveryOrders: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    cashOnHand: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    netProfit: 0,
    overdueInvoices: 0,
    pendingDeliveryOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // Fetch all invoices (using multiple pages if needed)
        let allInvoices: any[] = []
        let page = 1
        let hasMore = true
        
        while (hasMore) {
          const invoicesResponse = await fetch(`/api/autocount/invoices-v2?page=${page}&limit=100&status=`)
          if (invoicesResponse.ok) {
            const invoicesData = await invoicesResponse.json()
            const invoices = invoicesData.data || []
            allInvoices = [...allInvoices, ...invoices]
            
            if (invoices.length < 100 || page >= 10) { // Limit to 10 pages max (1000 invoices)
              hasMore = false
            } else {
              page++
            }
          } else {
            hasMore = false
          }
        }

        // Fetch delivery orders
        let allDeliveryOrders: any[] = []
        page = 1
        hasMore = true
        
        while (hasMore) {
          const doResponse = await fetch(`/api/autocount/delivery-orders-v2?page=${page}&limit=100&status=`)
          if (doResponse.ok) {
            const doData = await doResponse.json()
            const deliveryOrders = doData.data || []
            allDeliveryOrders = [...allDeliveryOrders, ...deliveryOrders]
            
            if (deliveryOrders.length < 100 || page >= 10) {
              hasMore = false
            } else {
              page++
            }
          } else {
            hasMore = false
          }
        }

        // Calculate financial metrics
        const now = new Date()
        let totalReceivable = 0
        let totalPaid = 0
        let overdueCount = 0
        let cashOnHand = 0

        allInvoices.forEach((inv: any) => {
          const total = parseFloat((inv.Total || inv.TotalAmount || 0).toString())
          const paid = parseFloat((inv.PaymentAmt || inv.LocalPaymentAmt || 0).toString())
          const outstanding = parseFloat((inv.Outstanding || (total - paid)).toString())
          const status = inv.Status || inv.DocStatus || ''
          
          // Calculate accounts receivable (unpaid invoices)
          // Status can be 'Unpaid', 'Partially Paid', 'Paid', 'Posted', 'Draft', etc.
          if (status !== 'Paid' && outstanding > 0) {
            totalReceivable += outstanding
          }
          
          // Calculate cash on hand (paid invoices)
          if (paid > 0) {
            totalPaid += paid
            cashOnHand += paid // Simplified: assume paid invoices = cash
          }
          
          // Check for overdue invoices
          if (inv.DueDate) {
            try {
              const dueDate = new Date(inv.DueDate)
              if (dueDate < now && outstanding > 0) {
                overdueCount++
              }
            } catch (e) {
              // Invalid date, skip
            }
          }
        })

        // Calculate pending delivery orders
        const pendingDO = allDeliveryOrders.filter((doItem: any) => 
          doItem.Status === 'Pending' || doItem.Status === 'Draft'
        ).length

        // For accounts payable, we'd need supplier invoices which aren't available yet
        // For now, use a placeholder
        const accountsPayable = 0 // Would need to query from supplier invoices
        const netProfit = totalPaid - accountsPayable // Simplified calculation

        setStats({
          cashOnHand,
          accountsReceivable: totalReceivable,
          accountsPayable,
          netProfit,
          overdueInvoices: overdueCount,
          pendingDeliveryOrders: pendingDO,
        })
        
        // Store invoices for the chart
        setInvoices(allInvoices)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your business."
      />
      <div className="px-8 pb-8 flex-1">
    <div className="space-y-8">

      {/* Financial Health Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6', borderLeftWidth: '4px', borderLeftColor: '#4C9AFF' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-sm font-medium" style={{ color: '#6B778C' }}>
              Cash on Hand
            </CardTitle>
            <svg
              className="h-5 w-5"
              style={{ color: '#4C9AFF' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div 
              className="text-3xl font-bold mb-1"
              style={{ 
                color: '#172B4D',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" on, "lnum" on'
              }}
            >
              {loading ? '...' : formatCurrency(stats.cashOnHand)}
            </div>
            <p className="text-xs" style={{ color: '#6B778C' }}>
              <span className="inline-flex items-center">
                <span>No change</span>
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6', borderLeftWidth: '4px', borderLeftColor: '#006644' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-sm font-medium" style={{ color: '#6B778C' }}>
              Accounts Receivable
            </CardTitle>
            <svg
              className="h-5 w-5"
              style={{ color: '#006644' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div 
              className="text-3xl font-bold mb-1"
              style={{ 
                color: '#006644',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" on, "lnum" on'
              }}
            >
              {loading ? '...' : formatCurrency(stats.accountsReceivable)}
            </div>
            <p className="text-xs" style={{ color: '#6B778C' }}>
              <span className="inline-flex items-center">
                Outstanding invoices
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6', borderLeftWidth: '4px', borderLeftColor: '#DE350B' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-sm font-medium" style={{ color: '#6B778C' }}>
              Accounts Payable
            </CardTitle>
            <svg
              className="h-5 w-5"
              style={{ color: '#DE350B' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div 
              className="text-3xl font-bold mb-1"
              style={{ 
                color: '#DE350B',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" on, "lnum" on'
              }}
            >
              {loading ? '...' : formatCurrency(stats.accountsPayable)}
            </div>
            <p className="text-xs" style={{ color: '#6B778C' }}>
              <span className="inline-flex items-center">
                Outstanding bills
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6', borderLeftWidth: '4px', borderLeftColor: stats.netProfit >= 0 ? '#006644' : '#DE350B' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-sm font-medium" style={{ color: '#6B778C' }}>
              Net Profit
            </CardTitle>
            <svg
              className="h-5 w-5"
              style={{ color: stats.netProfit >= 0 ? '#006644' : '#DE350B' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div 
              className="text-3xl font-bold mb-1"
              style={{ 
                color: stats.netProfit >= 0 ? '#006644' : '#DE350B',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" on, "lnum" on'
              }}
            >
              {loading ? '...' : formatCurrency(stats.netProfit)}
            </div>
            <p className="text-xs" style={{ color: '#6B778C' }}>
              <span className="inline-flex items-center">
                This period
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6' }}>
          <CardHeader className="px-6 pt-6">
            <CardTitle style={{ color: '#172B4D' }}>Cash Flow</CardTitle>
            <CardDescription style={{ color: '#6B778C' }}>
              Revenue vs Expenses over time
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Overview invoices={invoices} />
          </CardContent>
        </Card>

        <Card className="col-span-3" style={{ backgroundColor: '#FFFFFF', borderColor: '#DFE1E6' }}>
          <CardHeader className="px-6 pt-6">
            <CardTitle style={{ color: '#172B4D' }}>Action Items</CardTitle>
            <CardDescription style={{ color: '#6B778C' }}>
              Items requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <RecentActivity 
              overdueInvoices={stats.overdueInvoices}
              pendingDeliveryOrders={stats.pendingDeliveryOrders}
            />
          </CardContent>
        </Card>
      </div>
    </div>
      </div>
    </>
  )
}
