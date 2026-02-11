'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { BranchTabs } from '@/components/dashboard/BranchTabs'
import { useUser } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface TemporaryReceipt {
  _id: string
  docNo: string
  docDate: string
  paymentDate: string // Renamed from dueDate
  debtorCode: string
  description: string | null
  salesAgent: string | null
  currencyCode: string
  currencyRate: number
  total: number | null
  localTotal: number | null
  tax: number | null
  netTotal: number | null
  paymentAmt: number | null
  outstanding: number | null
  cancelled: string
  docStatus: string
  lastModified: string
  createdByName?: string | null
  paymentMethod?: string | null
  priceCharge?: number | null
  priceReceive?: number | null
  remark?: string | null
}

interface TemporaryReceiptDetail {
  _id: string
  docNo: string
  docDate: string
  paymentDate: string // Renamed from dueDate
  debtorCode: string
  description: string | null
  salesAgent: string | null
  currencyCode: string
  currencyRate: number
  total: number | null
  localTotal: number | null
  tax: number | null
  netTotal: number | null
  paymentAmt: number | null
  outstanding: number | null
  cancelled: string
  docStatus: string
  lineItems: TemporaryReceiptLineItem[]
  createdByName?: string | null
  paymentMethod?: string | null
  priceCharge?: number | null
  priceReceive?: number | null
  remark?: string | null
}

interface TemporaryReceiptLineItem {
  _id: string
  receiptId: string
  seq: number
  accNo: string | null
  description: string | null
  taxCode: string | null
  tax: number | null
  amount: number | null
  netAmount: number | null
  subTotal: number | null
  taxRate: number | null
}

export default function TemporaryReceiptsPage() {
  const { user } = useUser()
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)
  const [receipts, setReceipts] = useState<TemporaryReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [selectedBranchId, setSelectedBranchId] = useState<Id<'branches'> | null>(null)
  const [receiptDetail, setReceiptDetail] = useState<TemporaryReceiptDetail | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    docNo: '',
    docDate: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0], // Renamed from dueDate
    debtorCode: '',
    description: '',
    salesAgent: '',
    paymentMethod: '',
    priceCharge: '',
    priceReceive: '',
    remark: '',
  })
  
  // Customer selection state (matching delivery orders flow)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSelected, setCustomerSelected] = useState(false)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [debtorTypeFilter, setDebtorTypeFilter] = useState<string>('')
  const [registerNoSearch, setRegisterNoSearch] = useState<string>('')
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  
  // Get current user's branch
  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : 'skip'
  )
  const branches = useQuery(api.branches.getBranches) || []
  
  // For Staff: Auto-select their branch and filter
  useEffect(() => {
    if (userRole === 'staff' && currentUser?.branchId && !selectedBranchId) {
      setSelectedBranchId(currentUser.branchId)
    }
  }, [userRole, currentUser?.branchId, selectedBranchId])
  
  // Get branch prefix for TR numbering
  const getBranchPrefix = (): string | null => {
    if (selectedBranchId) {
      const branch = branches.find((b: any) => b._id === selectedBranchId)
      return branch?.trNumbering || branch?.doNumbering || null
    }
    // For staff, use their assigned branch
    if (userRole === 'staff' && currentUser?.branchId) {
      const branch = branches.find((b: any) => b._id === currentUser.branchId)
      return branch?.trNumbering || branch?.doNumbering || null
    }
    return null
  }
  
  // Get branchId for creating receipts
  const getBranchId = (): Id<'branches'> | undefined => {
    if (selectedBranchId) {
      return selectedBranchId
    }
    if (userRole === 'staff' && currentUser?.branchId) {
      return currentUser.branchId
    }
    return undefined
  }

  const branchIdForReceipt = getBranchId()
  const nextReceiptNumber = useQuery(
    api.temporaryReceipts.getNextReceiptNumber,
    showAddModal && branchIdForReceipt ? { branchId: branchIdForReceipt } : 'skip'
  )

  // Fetch customers list
  const fetchCustomersList = async () => {
    try {
      const response = await fetch('/api/autocount/customers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        // Show customers that appear active (Y or T) - we'll validate at submission time
        const activeCustomers = (data.data || []).filter((customer: any) => {
          const isActive = customer.IsActive === 'Y' || customer.IsActive === 'T'
          return isActive
        })
        setCustomers(activeCustomers)
        // Apply filters if set
        applyCustomerFilters(activeCustomers)
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }

  // Filter customers based on DebtorType and RegisterNo
  const applyCustomerFilters = (customerList?: any[]) => {
    const listToFilter = customerList || customers
    let filtered = listToFilter

    // Filter by DebtorType if selected
    if (debtorTypeFilter) {
      filtered = filtered.filter((customer: any) => 
        customer.DebtorType === debtorTypeFilter
      )
    }

    // Filter by RegisterNo if entered
    if (registerNoSearch.trim()) {
      const searchTerm = registerNoSearch.trim().toLowerCase()
      filtered = filtered.filter((customer: any) => 
        customer.RegisterNo && customer.RegisterNo.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredCustomers(filtered)
  }

  // Update filters when they change
  useEffect(() => {
    if (customers.length > 0) {
      applyCustomerFilters()
    }
  }, [debtorTypeFilter, registerNoSearch, customers])

  // Handle customer selection from suggestions
  const handleCustomerSelectFromSuggestions = async (customer: any) => {
    setRegisterNoSearch(customer.RegisterNo || '')
    setShowCustomerSuggestions(false)
    await handleCustomerSelect(customer.AccNo)
  }

  // Handle customer selection and auto-fill
  const handleCustomerSelect = async (debtorCode: string) => {
    if (!debtorCode) {
      setCustomerSelected(false)
      setFormData(prev => ({
        ...prev,
        debtorCode: '',
      }))
      return
    }

    setLoadingCustomer(true)
    setError(null)
    try {
      const response = await fetch(`/api/autocount/customers/${encodeURIComponent(debtorCode)}`)
      if (response.ok) {
        const data = await response.json()
        const customer = data.data
        
        // Check if customer is active - use same logic as customers table (Y or T = active)
        if (customer.IsActive !== 'Y' && customer.IsActive !== 'T') {
          setError(`Customer "${debtorCode}" is inactive. Please select an active customer.`)
          setCustomerSelected(false)
          setFormData(prev => ({
            ...prev,
            debtorCode: '',
          }))
          setLoadingCustomer(false)
          return
        }
        
        // Auto-fill fields from customer data
        setFormData(prev => ({
          ...prev,
          debtorCode: debtorCode,
        }))
        setCustomerSelected(true)
        setSelectedCustomerName(customer.CompanyName || customer.AccNo)
        setShowCustomerSuggestions(false)
        setError(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || errorData.message || `Customer "${debtorCode}" not found. Please select a valid customer.`)
        setCustomerSelected(false)
        setFormData(prev => ({
          ...prev,
          debtorCode: '',
        }))
      }
    } catch (err) {
      console.error('Error fetching customer:', err)
      setError(`Failed to load customer details: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setCustomerSelected(false)
      setFormData(prev => ({
        ...prev,
        debtorCode: '',
      }))
    } finally {
      setLoadingCustomer(false)
    }
  }

  // Fetch temporary receipts
  const fetchReceipts = async (pageNum: number = 1, searchTerm: string = '', statusFilter: string = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      })
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      if (statusFilter) {
        params.append('status', statusFilter)
      }
      
      // Add branch filter
      const branchIdToFilter = selectedBranchId || (userRole === 'staff' && currentUser?.branchId ? currentUser.branchId : null)
      if (branchIdToFilter) {
        params.append('branchId', branchIdToFilter)
      }

      const response = await fetch(`/api/temporary-receipts?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch temporary receipts')
      }

      const data = await response.json()
      setReceipts(data.data || [])
      setTotal(data.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load temporary receipts')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchReceipts(1, search, status)
    fetchCustomersList()
  }, [])

  // Auto-reset form when modal opens/closes
  useEffect(() => {
    if (showAddModal) {
      setDebtorTypeFilter('')
      setRegisterNoSearch('')
      setFilteredCustomers([])
      setCustomerSelected(false)
      setShowCustomerSuggestions(false)
      setSelectedCustomerName('')
      setFormData({
        docNo: '',
        docDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        debtorCode: '',
        description: '',
        salesAgent: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : '',
        paymentMethod: '',
        priceCharge: '',
        priceReceive: '',
        remark: '',
      })
    }
  }, [showAddModal, user])

  // When create modal is open and next receipt number is available, set docNo (branch-prefixed)
  useEffect(() => {
    if (showAddModal && nextReceiptNumber?.nextDocNo) {
      setFormData((prev) => ({ ...prev, docNo: nextReceiptNumber.nextDocNo }))
    }
  }, [showAddModal, nextReceiptNumber?.nextDocNo])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchReceipts(1, search, status)
  }

  // Handle status filter change
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    fetchReceipts(1, search, newStatus)
  }

  // Handle view receipt
  const handleViewReceipt = async (receiptId: string) => {
    try {
      const response = await fetch(`/api/temporary-receipts/${receiptId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch temporary receipt details')
      }
      const data = await response.json()
      setReceiptDetail(data.data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load temporary receipt details')
    }
  }

  // Handle create receipt
  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[TempReceipt Create] Form submitted', { formData })
    setSaving(true)
    setError(null)

    try {
      // Validate customer is selected
      if (!customerSelected || !formData.debtorCode) {
        setError('Please select a customer')
        setSaving(false)
        return
      }
      
      // docNo is optional - will be auto-generated if not provided
      if (!formData.docDate || !formData.paymentDate) {
        console.warn('[TempReceipt Create] Validation failed - missing required fields', formData)
        setError('All required fields must be filled')
        setSaving(false)
        return
      }

      const branchId = getBranchId()
      
      // Get current user's name for creator
      const currentUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : ''
      
      const requestBody = {
        header: {
          docNo: formData.docNo || undefined, // Optional - will be auto-generated
          docDate: formData.docDate,
          paymentDate: formData.paymentDate, // Renamed from dueDate
          debtorCode: formData.debtorCode,
          description: formData.description,
          salesAgent: formData.salesAgent,
          currencyCode: 'MYR', // Hardcoded
          currencyRate: 1, // Hardcoded
          createdByName: currentUserName, // Creator name
          paymentMethod: formData.paymentMethod || undefined,
          priceReceive: formData.priceReceive ? parseFloat(formData.priceReceive.toString()) : undefined,
          remark: formData.remark || undefined,
          branchId: branchId,
        },
        lineItems: [],
      }
      console.log('[TempReceipt Create] Sending request to API', requestBody)

      const response = await fetch('/api/temporary-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[TempReceipt Create] API response status', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[TempReceipt Create] API error', errorData)
        throw new Error(errorData.error || 'Failed to create temporary receipt')
      }

      const responseData = await response.json()
      console.log('[TempReceipt Create] Success', responseData)

      setShowAddModal(false)
      console.log('[TempReceipt Create] Resetting form data')
      setDebtorTypeFilter('')
      setRegisterNoSearch('')
      setFilteredCustomers([])
      setCustomerSelected(false)
      setShowCustomerSuggestions(false)
      setSelectedCustomerName('')
      setFormData({
        docNo: '',
        docDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0], // Renamed from dueDate
        debtorCode: '',
        description: '',
        salesAgent: '',
        paymentMethod: '',
        priceCharge: '',
        priceReceive: '',
        remark: '',
      })
      await fetchReceipts(page, search, status)
      alert('Temporary receipt created successfully')
    } catch (err) {
      console.error('[TempReceipt Create] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to create temporary receipt')
    } finally {
      setSaving(false)
      console.log('[TempReceipt Create] Form submission completed')
    }
  }


  // Handle delete
  const handleDelete = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this temporary receipt?')) {
      return
    }

    try {
      const response = await fetch(`/api/temporary-receipts/${receiptId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete temporary receipt')
      }

      // Refresh list
      await fetchReceipts(page, search, status)
      alert('Temporary receipt deleted successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete temporary receipt')
    }
  }

  return (
    <>
      <PageHeader
        title="Temporary Receipts"
        description="Manage temporary payment receipts (stored in Convex database)."
        actionLabel="Create Receipt"
        actionIcon="add"
        onAction={() => {
          setFormData({
            docNo: '', // Set by useEffect from getNextReceiptNumber when modal opens
            docDate: new Date().toISOString().split('T')[0],
            paymentDate: new Date().toISOString().split('T')[0],
            debtorCode: '',
            description: '',
            salesAgent: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : '',
            paymentMethod: '',
            priceCharge: '',
            priceReceive: '',
            remark: '',
          })
          setShowAddModal(true)
        }}
      />
      <div className="px-8 pb-8 flex-1">
        {/* Branch Tabs - Show for Admin and Super Admin */}
        {(permissions.canCreateBranch || (userRole === 'staff' && currentUser?.branchId)) && branches.length > 0 && (
          <BranchTabs
            selectedBranchId={selectedBranchId}
            onBranchChange={(branchId) => {
              setSelectedBranchId(branchId)
              fetchReceipts(1, search, status)
            }}
            restrictToBranchId={userRole === 'staff' && currentUser?.branchId ? currentUser.branchId : null}
          />
        )}

        <div className="space-y-4">
          {/* Search and Filters */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Temporary Receipt List</CardTitle>
            <div className="flex gap-2">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search temporary receipts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
                <Button type="submit">Search</Button>
              </form>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading temporary receipts...</div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search || status ? 'No temporary receipts found matching your filters' : 'No temporary receipts found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 font-semibold">Receipt No</th>
                      <th className="text-left p-2 font-semibold">Date</th>
                      <th className="text-left p-2 font-semibold">Customer</th>
                      <th className="text-left p-2 font-semibold">Total</th>
                      <th className="text-left p-2 font-semibold">Paid</th>
                      <th className="text-left p-2 font-semibold">Outstanding</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                      <th className="text-left p-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={receipt._id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{receipt.docNo}</td>
                        <td className="p-2">
                          {new Date(receipt.docDate).toLocaleDateString()}
                        </td>
                        <td className="p-2">{receipt.debtorCode}</td>
                        <td className="p-2">
                          {receipt.total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receipt.total))
                            : '-'}
                        </td>
                        <td className="p-2">
                          {receipt.paymentAmt
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receipt.paymentAmt))
                            : '-'}
                        </td>
                        <td className="p-2">
                          {receipt.outstanding
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receipt.outstanding))
                            : '-'}
                        </td>
                        <td className="p-2">
                          {receipt.cancelled === 'Y' ? (
                            <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                              Cancelled
                            </span>
                          ) : receipt.outstanding && Number(receipt.outstanding) <= 0 ? (
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                              Paid
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewReceipt(receipt._id)}
                            >
                              View
                            </Button>
                            {receipt.cancelled !== 'Y' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(receipt._id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {Math.ceil(total / limit) > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    onClick={() => fetchReceipts(page - 1, search, status)}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(total / limit)} ({total} receipts)
                  </span>
                  <Button
                    onClick={() => fetchReceipts(page + 1, search, status)}
                    disabled={page >= Math.ceil(total / limit)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Temporary Receipt Modal */}
      {receiptDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Temporary Receipt Details: {receiptDetail.docNo}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setReceiptDetail(null)}>
                    ×
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <Label className="text-sm font-semibold">Receipt Number</Label>
                    <p className="text-sm">{receiptDetail.docNo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Date</Label>
                    <p className="text-sm">{new Date(receiptDetail.docDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Payment Date</Label>
                    <p className="text-sm">{new Date(receiptDetail.paymentDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Customer</Label>
                    <p className="text-sm">{receiptDetail.debtorCode}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Currency</Label>
                    <p className="text-sm">MYR (Rate: 1)</p>
                  </div>
                  {receiptDetail.createdByName && (
                    <div>
                      <Label className="text-sm font-semibold">Created By</Label>
                      <p className="text-sm">{receiptDetail.createdByName}</p>
                    </div>
                  )}
                  {receiptDetail.paymentMethod && (
                    <div>
                      <Label className="text-sm font-semibold">Payment Method</Label>
                      <p className="text-sm">{receiptDetail.paymentMethod}</p>
                    </div>
                  )}
                  {receiptDetail.priceReceive !== null && receiptDetail.priceReceive !== undefined && (
                    <div>
                      <Label className="text-sm font-semibold">Price Receive</Label>
                      <p className="text-sm">
                        {new Intl.NumberFormat('en-MY', {
                          style: 'currency',
                          currency: 'MYR',
                        }).format(Number(receiptDetail.priceReceive))}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-semibold">Status</Label>
                    <p className="text-sm">
                      {receiptDetail.cancelled === 'Y' ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          Cancelled
                        </span>
                      ) : receiptDetail.outstanding && Number(receiptDetail.outstanding) <= 0 ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                          Unpaid
                        </span>
                      )}
                    </p>
                  </div>
                  {receiptDetail.remark && (
                    <div className="col-span-2">
                      <Label className="text-sm font-semibold">Remark</Label>
                      <p className="text-sm">{receiptDetail.remark}</p>
                    </div>
                  )}
                </div>

                {/* Line Items */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Line Items</Label>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 font-semibold text-sm">Seq</th>
                          <th className="text-left p-2 font-semibold text-sm">Account</th>
                          <th className="text-left p-2 font-semibold text-sm">Description</th>
                          <th className="text-right p-2 font-semibold text-sm">Tax Code</th>
                          <th className="text-right p-2 font-semibold text-sm">Amount</th>
                          <th className="text-right p-2 font-semibold text-sm">Tax</th>
                          <th className="text-right p-2 font-semibold text-sm">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptDetail.lineItems && receiptDetail.lineItems.length > 0 ? (
                          receiptDetail.lineItems.map((item) => (
                            <tr key={item._id} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm">{item.seq}</td>
                              <td className="p-2 text-sm">{item.accNo || '-'}</td>
                              <td className="p-2 text-sm">{item.description || '-'}</td>
                              <td className="p-2 text-sm text-right">{item.taxCode || '-'}</td>
                              <td className="p-2 text-sm text-right">
                                {item.amount
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(item.amount))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {item.tax
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(item.tax))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {item.subTotal
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(item.subTotal))
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-sm text-muted-foreground">
                              No line items found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Subtotal:</Label>
                        <p className="text-sm">
                          {receiptDetail.netTotal
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receiptDetail.netTotal))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Tax:</Label>
                        <p className="text-sm">
                          {receiptDetail.tax
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receiptDetail.tax))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-sm font-bold">Total:</Label>
                        <p className="text-sm font-bold">
                          {receiptDetail.total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receiptDetail.total))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Paid:</Label>
                        <p className="text-sm">
                          {receiptDetail.paymentAmt
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receiptDetail.paymentAmt))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-sm font-bold">Outstanding:</Label>
                        <p className="text-sm font-bold">
                          {receiptDetail.outstanding
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                              }).format(Number(receiptDetail.outstanding))
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Temporary Receipt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Temporary Receipt</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowAddModal(false)
                  setDebtorTypeFilter('')
                  setRegisterNoSearch('')
                  setFilteredCustomers([])
                  setCustomerSelected(false)
                  setShowCustomerSuggestions(false)
                  setSelectedCustomerName('')
                  setFormData({
                    docNo: '',
                    docDate: new Date().toISOString().split('T')[0],
                    paymentDate: new Date().toISOString().split('T')[0], // Renamed from dueDate
                    debtorCode: '',
                    description: '',
                    salesAgent: '',
                    paymentMethod: '',
                    priceCharge: '',
                    priceReceive: '',
                    remark: '',
                  })
                }}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleCreateReceipt} className="space-y-6">
                {/* Step 1: Customer Selection */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-4">Step 1: Select NRIC/Passport</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="debtor-type">Type *</Label>
                      <select
                        id="debtor-type"
                        value={debtorTypeFilter}
                        onChange={(e) => {
                          setDebtorTypeFilter(e.target.value)
                          setRegisterNoSearch('')
                          setFormData(prev => ({ ...prev, debtorCode: '' }))
                          setCustomerSelected(false)
                        }}
                        required
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">Select Type</option>
                        <option value="NRIC">NRIC</option>
                        <option value="PASSPORT">PASSPORT</option>
                      </select>
                    </div>
                    {debtorTypeFilter && (
                      <div className="relative">
                        <Label htmlFor="register-no">Customer *</Label>
                        <Input
                          id="register-no"
                          type="text"
                          value={registerNoSearch}
                          onChange={(e) => {
                            setRegisterNoSearch(e.target.value)
                            setFormData(prev => ({ ...prev, debtorCode: '' }))
                            setCustomerSelected(false)
                            setSelectedCustomerName('')
                            setShowCustomerSuggestions(true)
                          }}
                          onFocus={() => {
                            if (registerNoSearch.trim() && filteredCustomers.length > 0) {
                              setShowCustomerSuggestions(true)
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding suggestions to allow click on suggestion
                            setTimeout(() => setShowCustomerSuggestions(false), 200)
                          }}
                          placeholder="Enter Register No to search"
                          required
                          className="w-full"
                        />
                        {/* Customer Suggestions Dropdown */}
                        {showCustomerSuggestions && filteredCustomers.length > 0 && registerNoSearch.trim() && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredCustomers.map((customer) => (
                              <div
                                key={customer.AccNo}
                                onClick={() => handleCustomerSelectFromSuggestions(customer)}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium">{customer.CompanyName || customer.AccNo}</div>
                                <div className="text-sm text-gray-500">
                                  {customer.AccNo} {customer.RegisterNo ? `- ${customer.RegisterNo}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Selected Customer Display */}
                        {customerSelected && selectedCustomerName && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-800">
                              <span className="font-semibold">Selected:</span> {selectedCustomerName} ({formData.debtorCode})
                            </p>
                          </div>
                        )}
                        {/* No Results Message */}
                        {filteredCustomers.length === 0 && registerNoSearch.trim() && !showCustomerSuggestions && (
                          <p className="text-sm text-amber-600 mt-1">
                            No customer found with Type "{debtorTypeFilter}" and Register No matching "{registerNoSearch}"
                          </p>
                        )}
                        {loadingCustomer && (
                          <p className="text-sm text-gray-500 mt-1">Loading customer details...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Receipt Details (only shown after customer selection) */}
                {customerSelected && (
                  <>
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold mb-4">Step 2: Receipt Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="do-Branch">Branch</Label>
                          <Input
                            id="do-Branch"
                            value={
                              (() => {
                                const branchId = branchIdForReceipt
                                const branch = branches.find((b: { _id: Id<'branches'> }) => b._id === branchId)
                                return branch ? (branch.alias || branch.branchName) : '—'
                              })()
                            }
                            readOnly
                            className="bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <Label htmlFor="docDate">Date *</Label>
                          <Input
                            id="docDate"
                            type="date"
                            value={formData.docDate}
                            onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="paymentDate">Payment Date *</Label>
                          <Input
                            id="paymentDate"
                            type="date"
                            value={formData.paymentDate}
                            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="createdByName">Created By</Label>
                          <Input
                            id="createdByName"
                            value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : ''}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="paymentMethod">Payment Method</Label>
                          <select
                            id="paymentMethod"
                            value={formData.paymentMethod}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="">Select Payment Method</option>
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="priceReceive">Price Receive</Label>
                          <Input
                            id="priceReceive"
                            type="number"
                            step="0.01"
                            value={formData.priceReceive}
                            onChange={(e) => setFormData({ ...formData, priceReceive: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <Label htmlFor="remark">Remark</Label>
                      <Input
                        id="remark"
                        value={formData.remark}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                        placeholder="Additional notes or remarks"
                        maxLength={255}
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false)
                      setDebtorTypeFilter('')
                      setRegisterNoSearch('')
                      setFilteredCustomers([])
                      setCustomerSelected(false)
                      setShowCustomerSuggestions(false)
                      setSelectedCustomerName('')
                      setFormData({
                        docNo: '',
                        docDate: new Date().toISOString().split('T')[0],
                        paymentDate: new Date().toISOString().split('T')[0], // Renamed from dueDate
                        debtorCode: '',
                        description: '',
                        salesAgent: '',
                        paymentMethod: '',
                        priceCharge: '',
                        priceReceive: '',
                        remark: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Receipt'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

        </div>
      </div>
    </>
  )
}
