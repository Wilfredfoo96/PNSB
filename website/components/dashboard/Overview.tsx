'use client'

export interface Invoice {
  DocDate?: string
  Total?: number
  TotalAmount?: number
  Status?: string
  PaymentAmt?: number
  LocalPaymentAmt?: number
}

export interface OverviewProps {
  invoices: Invoice[]
}

export function Overview({ invoices }: OverviewProps) {
  // Calculate monthly revenue and expenses from invoices
  const getMonthlyData = () => {
    const now = new Date()
    const months: { [key: string]: { revenue: number; expenses: number } } = {}
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      months[monthKey] = { revenue: 0, expenses: 0 }
    }
    
    // Process invoices
    invoices.forEach((inv) => {
      if (!inv.DocDate) return
      
      const docDate = new Date(inv.DocDate)
      const monthKey = docDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      const total = parseFloat((inv.Total || inv.TotalAmount || 0).toString())
      const paid = parseFloat((inv.PaymentAmt || inv.LocalPaymentAmt || 0).toString())
      
      // Revenue: total invoice amount (when invoice is created)
      if (months[monthKey]) {
        months[monthKey].revenue += total
      }
      
      // Expenses: for now, we'll use a simplified calculation
      // In a real system, expenses would come from supplier invoices/purchases
      // For now, we'll show 0 or use a percentage of revenue as placeholder
      if (months[monthKey] && paid > 0) {
        // Simplified: assume expenses are 60% of revenue (this is a placeholder)
        // In production, you'd fetch actual expense data
        months[monthKey].expenses += total * 0.6
      }
    })
    
    return months
  }
  
  const monthlyData = getMonthlyData()
  const monthKeys = Object.keys(monthlyData)
  const revenueValues = monthKeys.map(key => monthlyData[key].revenue)
  const expenseValues = monthKeys.map(key => monthlyData[key].expenses)
  const maxValue = Math.max(...revenueValues, ...expenseValues, 1) // At least 1 to avoid division by zero
  
  // Generate grid lines (5 horizontal lines)
  const gridLines = Array.from({ length: 5 }, (_, i) => i + 1)

  if (invoices.length === 0) {
  return (
      <div className="h-[300px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed" style={{ borderColor: '#DFE1E6' }}>
      <div className="text-center">
        <svg
            className="mx-auto h-12 w-12"
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
          <h3 className="mt-2 text-sm font-semibold" style={{ color: '#172B4D' }}>
            No Data Available
          </h3>
          <p className="mt-1 text-sm" style={{ color: '#6B778C' }}>
            Invoice data will appear here once available
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[300px] flex flex-col relative">
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between" style={{ paddingTop: '20px', paddingBottom: '60px' }}>
        {gridLines.map((line) => (
          <div
            key={line}
            className="w-full border-t"
            style={{ 
              borderColor: '#EBECF0',
              opacity: 0.5
            }}
          />
        ))}
      </div>

      {/* Chart bars */}
      <div className="flex-1 flex items-end justify-between gap-2 relative z-10" style={{ paddingTop: '20px', paddingBottom: '60px' }}>
        {monthKeys.map((monthKey) => {
          const monthData = monthlyData[monthKey]
          const revenueHeight = maxValue > 0 ? (monthData.revenue / maxValue) * 100 : 0
          const expenseHeight = maxValue > 0 ? (monthData.expenses / maxValue) * 100 : 0
          const hasData = monthData.revenue > 0 || monthData.expenses > 0
          
          return (
            <div key={monthKey} className="flex-1 flex flex-col items-center gap-1 max-w-[80px]">
              <div className="w-full flex flex-col items-center justify-end gap-0.5 relative" style={{ height: '100%' }}>
                {/* Show baseline for empty months */}
                {!hasData && (
                  <div
                    className="w-full border-t"
                    style={{
                      borderColor: '#DFE1E6',
                      opacity: 0.3,
                      position: 'absolute',
                      bottom: 0,
                    }}
                  />
                )}
                
                {/* Revenue bar */}
                {hasData && (
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${revenueHeight}%`,
                      backgroundColor: '#006644',
                      minHeight: revenueHeight > 0 ? '2px' : '0',
                      maxWidth: '100%',
                    }}
                    title={`Revenue: ${monthData.revenue.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })}`}
                  />
                )}
                
                {/* Expenses bar */}
                {hasData && (
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${expenseHeight}%`,
                      backgroundColor: '#DE350B',
                      minHeight: expenseHeight > 0 ? '2px' : '0',
                      maxWidth: '100%',
                    }}
                    title={`Expenses: ${monthData.expenses.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })}`}
                  />
                )}
              </div>
              <span className="text-xs mt-2" style={{ color: '#6B778C' }}>
                {monthKey.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t relative z-10" style={{ borderColor: '#DFE1E6' }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#006644' }} />
          <span className="text-xs" style={{ color: '#6B778C' }}>Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#DE350B' }} />
          <span className="text-xs" style={{ color: '#6B778C' }}>Expenses</span>
        </div>
      </div>
    </div>
  )
}
