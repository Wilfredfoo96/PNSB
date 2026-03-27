'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useUser } from '@clerk/nextjs'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

// ——— Helpers ———
function formatMovementType(type: string): string {
  if (type === 'DO_OUT') return 'Delivery'
  if (type === 'DO_VOID_IN') return 'Return'
  if (type === 'ADJUSTMENT') return 'Adjustment'
  return type
}

function formatDocument(refType?: string, refId?: string): string {
  if (!refType || !refId) return '—'
  if (refType === 'DELIVERY_ORDER') return `Delivery order #${refId}`
  if (refType === 'ADJUSTMENT') return 'Manual adjustment'
  return `${refType} ${refId}`
}

function relativeTime(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 60) return 'Just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`
  return new Date(ms).toLocaleDateString('en-GB')
}

function lastMovementSummary(
  lastUpdated: number | null,
  lastMovementType?: string,
  lastMovementDelta?: number
): string {
  if (!lastUpdated) return '—'
  const when = relativeTime(lastUpdated)
  if (lastMovementType != null && lastMovementDelta != null) {
    const label = formatMovementType(lastMovementType)
    const delta = lastMovementDelta >= 0 ? `+${lastMovementDelta}` : String(lastMovementDelta)
    return `${when}, ${label} ${delta}`
  }
  return when
}

// ——— Types ———
interface Product {
  ItemCode: string
  Description?: string | null
}

interface StockItem {
  _id: Id<'stockKeeping'>
  itemCode: string
  quantity: number
  lastUpdated: number
  lastUpdatedBy: string
  lastMovementType?: string
  lastMovementDelta?: number
  notes?: string
}

interface MergedStockItem {
  itemCode: string
  description?: string | null
  quantity: number
  lastUpdated: number | null
  lastMovementType?: string
  lastMovementDelta?: number
  notes?: string
}

const REASON_OPTIONS = ['Received +', 'Damage -', 'Loss -', 'Adjustment +', 'Adjustment -'] as const

export default function StockKeepingPage() {
  const { user } = useUser()
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)

  const stocks = useQuery(api.stockKeeping.getAll) ?? []
  const updateQuantity = useMutation(api.stockKeeping.updateQuantity)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // History drawer (right)
  const [historyItemCode, setHistoryItemCode] = useState<string | null>(null)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('')
  const [historyDatePreset, setHistoryDatePreset] = useState<'7' | '30'>('30')

  const fromTime = useMemo(() => {
    const days = historyDatePreset === '7' ? 7 : 30
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [historyDatePreset])

  const movementLogs = useQuery(
    api.stockKeeping.getMovementLogsByItem,
    historyItemCode
      ? {
          itemCode: historyItemCode,
          limit: 200,
          fromTime,
          movementType: historyTypeFilter || undefined,
        }
      : 'skip'
  ) ?? []

  // Edit modal (per-row: quantity + remarks)
  const [editItemCode, setEditItemCode] = useState<string | null>(null)
  const [editNewQty, setEditNewQty] = useState('')
  const [editRemarks, setEditRemarks] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchAllProducts = async () => {
      setLoading(true)
      try {
        const allProducts: Product[] = []
        let page = 1
        let hasMore = true
        const pageSize = 100
        while (hasMore) {
          const response = await fetch(
            `/api/autocount/products-v2?page=${page}&limit=${pageSize}&activeOnly=true`
          )
          if (!response.ok) throw new Error('Failed to fetch products')
          const data = await response.json()
          allProducts.push(...(data.data || []))
          hasMore = page < (data.pagination?.totalPages || 0)
          page++
        }
        setProducts(allProducts)
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAllProducts()
  }, [])

  const stockMap = useMemo(() => {
    const map = new Map<string, StockItem>()
    stocks.forEach((s) => map.set(s.itemCode, s))
    return map
  }, [stocks])

  const mergedStocks: MergedStockItem[] = useMemo(
    () =>
      products.map((p) => {
        const s = stockMap.get(p.ItemCode)
        return {
          itemCode: p.ItemCode,
          description: p.Description,
          quantity: s?.quantity ?? 0,
          lastUpdated: s?.lastUpdated ?? null,
          lastMovementType: s?.lastMovementType,
          lastMovementDelta: s?.lastMovementDelta,
          notes: s?.notes,
        }
      }),
    [products, stockMap]
  )

  const filteredStocks = useMemo(
    () =>
      mergedStocks.filter(
        (s) =>
          s.itemCode.toLowerCase().includes(search.toLowerCase()) ||
          (s.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      ),
    [mergedStocks, search]
  )

  const editStock = editItemCode ? mergedStocks.find((s) => s.itemCode === editItemCode) : null

  const openEdit = (stock: MergedStockItem) => {
    setEditItemCode(stock.itemCode)
    setEditNewQty(String(stock.quantity))
    setEditRemarks(stock.notes ?? '')
    setEditReason('')
    setEditSuccess(null)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItemCode) return
    const newQty = parseFloat(editNewQty)
    if (Number.isNaN(newQty)) {
      alert('Enter a valid quantity.')
      return
    }
    setEditSaving(true)
    setEditSuccess(null)
    try {
      const notes = editRemarks.trim() || editReason || undefined
      await updateQuantity({
        itemCode: editItemCode,
        quantity: newQty,
        notes: notes || undefined,
        userId: user?.id || 'SYSTEM',
      })
      setEditSuccess(`Stock updated. ${editItemCode}: ${newQty.toFixed(2)}`)
      setTimeout(() => {
        setEditItemCode(null)
        setEditNewQty('')
        setEditRemarks('')
        setEditReason('')
        setEditSuccess(null)
      }, 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update stock')
    } finally {
      setEditSaving(false)
    }
  }

  const handleExportHistoryCsv = () => {
    if (!historyItemCode || movementLogs.length === 0) return
    const headers = ['Time', 'Type', 'In', 'Out', 'Stock after', 'Document', 'Remarks']
    const rows = movementLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      formatMovementType(log.movementType),
      log.quantityDelta > 0 ? log.quantityDelta.toFixed(2) : '',
      log.quantityDelta < 0 ? Math.abs(log.quantityDelta).toFixed(2) : '',
      log.quantityAfter.toFixed(2),
      formatDocument(log.referenceType, log.referenceId),
      log.notes ?? '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `stock-history-${historyItemCode}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const historyItemDescription = useMemo(
    () => mergedStocks.find((s) => s.itemCode === historyItemCode)?.description ?? historyItemCode,
    [mergedStocks, historyItemCode]
  )

  return (
    <>
      <PageHeader
        title="Stock Keeping"
        description="View stock levels at a glance. Use History to see in/out movements; use Edit to update quantity and remarks."
      />
      <div className="px-8 pb-8 flex-1">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search by item code or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stock levels</CardTitle>
              <CardDescription>
                Current quantity and remarks per item. Use Action to view history or edit quantity and remarks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-semibold">Item code</th>
                        <th className="text-left p-2 font-semibold">Description</th>
                        <th className="text-right p-2 font-semibold">Quantity</th>
                        <th className="text-left p-2 font-semibold">Last movement</th>
                        <th className="text-left p-2 font-semibold">Remarks</th>
                        <th className="text-left p-2 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <tr key={i} className="border-b animate-pulse">
                          <td className="p-2"><span className="inline-block h-4 w-24 bg-gray-200 rounded" /></td>
                          <td className="p-2"><span className="inline-block h-4 w-40 bg-gray-200 rounded" /></td>
                          <td className="p-2 text-right"><span className="inline-block h-4 w-16 bg-gray-200 rounded ml-auto" /></td>
                          <td className="p-2"><span className="inline-block h-4 w-32 bg-gray-200 rounded" /></td>
                          <td className="p-2"><span className="inline-block h-4 w-28 bg-gray-200 rounded" /></td>
                          <td className="p-2"><span className="inline-block h-8 w-24 bg-gray-200 rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : filteredStocks.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  {search ? 'No products found matching your search.' : 'No products to show. Add products in Products first, or check filters.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-semibold">Item code</th>
                        <th className="text-left p-2 font-semibold">Description</th>
                        <th className="text-right p-2 font-semibold">Quantity</th>
                        <th className="text-left p-2 font-semibold">Last movement</th>
                        <th className="text-left p-2 font-semibold">Remarks</th>
                        <th className="text-left p-2 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStocks.map((stock) => {
                        const isOut = (stock.lastMovementDelta ?? 0) < 0
                        const isIn = (stock.lastMovementDelta ?? 0) > 0
                        return (
                          <tr key={stock.itemCode} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-semibold">{stock.itemCode}</td>
                            <td className="p-2 text-sm text-gray-600">{stock.description ?? '—'}</td>
                            <td className="p-2 text-right tabular-nums">
                              <span className={stock.quantity < 0 ? 'text-red-600 font-semibold' : ''}>
                                {stock.quantity.toFixed(2)}
                                {stock.quantity < 0 && ' (negative)'}
                              </span>
                            </td>
                            <td className="p-2 text-sm text-gray-600">
                              <span className="inline-flex items-center gap-1">
                                {isIn && <span className="inline-block w-2 h-2 rounded-full bg-green-500" />}
                                {isOut && <span className="inline-block w-2 h-2 rounded-full bg-red-500" />}
                                {lastMovementSummary(stock.lastUpdated, stock.lastMovementType, stock.lastMovementDelta)}
                              </span>
                            </td>
                            <td className="p-2 text-sm text-gray-600 max-w-[200px] truncate" title={stock.notes ?? ''}>
                              {stock.notes ?? '—'}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setHistoryItemCode(stock.itemCode)}
                                >
                                  History
                                </Button>
                                {permissions.canAccessSettings && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(stock)}
                                  >
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History popup */}
      {historyItemCode != null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHistoryItemCode(null)}>
          <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle>In/out history — {historyItemCode}</CardTitle>
                <CardDescription>{historyItemDescription}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setHistoryItemCode(null)}>×</Button>
            </CardHeader>
            <div className="flex-shrink-0 p-4 border-b flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Type</Label>
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="DO_OUT">Delivery (out)</option>
                  <option value="DO_VOID_IN">Return (void)</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Date</Label>
                <select
                  value={historyDatePreset}
                  onChange={(e) => setHistoryDatePreset(e.target.value as '7' | '30')}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportHistoryCsv} disabled={movementLogs.length === 0}>
                Export CSV
              </Button>
            </div>
            <CardContent className="flex-1 overflow-auto pt-4">
              {movementLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No stock history for this item yet. History appears when stock is delivered, returned, or adjusted.
                </p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 sticky top-0">
                      <th className="text-left p-2 font-semibold">Time</th>
                      <th className="text-left p-2 font-semibold">Type</th>
                      <th className="text-right p-2 font-semibold">In</th>
                      <th className="text-right p-2 font-semibold">Out</th>
                      <th className="text-right p-2 font-semibold">Stock after</th>
                      <th className="text-left p-2 font-semibold">Document</th>
                      <th className="text-left p-2 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementLogs.map((log) => (
                      <tr key={log._id} className="border-b hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-GB')}</td>
                        <td className="p-2">{formatMovementType(log.movementType)}</td>
                        <td className="p-2 text-right text-green-600 tabular-nums">
                          {log.quantityDelta > 0 ? log.quantityDelta.toFixed(2) : '—'}
                        </td>
                        <td className="p-2 text-right text-red-600 tabular-nums">
                          {log.quantityDelta < 0 ? Math.abs(log.quantityDelta).toFixed(2) : '—'}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">{log.quantityAfter.toFixed(2)}</td>
                        <td className="p-2 text-gray-600">{formatDocument(log.referenceType, log.referenceId)}</td>
                        <td className="p-2 text-gray-600 max-w-[180px] truncate" title={log.notes ?? ''}>
                          {log.notes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit modal (quantity + remarks) */}
      {editItemCode != null && editStock != null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !editSaving && setEditItemCode(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edit stock — {editStock.itemCode}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditItemCode(null)} disabled={editSaving}>×</Button>
            </CardHeader>
            <CardContent>
              {editSuccess ? (
                <p className="text-green-600 font-medium">{editSuccess}</p>
              ) : (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <Label>Item</Label>
                    <p className="text-sm text-gray-600 mt-1">{editStock.itemCode} — {editStock.description ?? '—'}</p>
                  </div>
                  <div>
                    <Label>Current quantity</Label>
                    <p className="text-lg font-mono mt-1">{editStock.quantity.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label>New quantity</Label>
                    <Input
                      type="number"
                      step="any"
                      value={editNewQty}
                      onChange={(e) => setEditNewQty(e.target.value)}
                      placeholder="e.g. 50"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <textarea
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      placeholder="Notes for this item..."
                      rows={3}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label>Reason for change (optional)</Label>
                    <select
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {REASON_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={editSaving}>
                      {editSaving ? 'Updating...' : 'Update stock'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditItemCode(null)} disabled={editSaving}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
