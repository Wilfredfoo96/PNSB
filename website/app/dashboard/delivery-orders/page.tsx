'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { BranchTabs } from '@/components/dashboard/BranchTabs'
import { useUser } from '@clerk/nextjs'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'
import { useToast } from '@/components/ui/toast'
import { formatISODateToDDMMYYYY, parseDDMMYYYYToISO } from '@/lib/utils'

interface DeliveryOrder {
  DocKey: number
  DocNo: string
  DocDate: string
  DebtorCode: string
  DebtorName: string | null
  Attention?: string | null
  Total: number | null
  NetTotal: number | null
  LocalNetTotal: number | null
  Tax: number | null
  PostToStock: string
  Transferable: string
  Cancelled: string
  DocStatus: string
  Status?: string
  CurrencyCode: string
  LastModified: string
  Remark4?: string | null
}

export default function DeliveryOrdersPage() {
  const { user } = useUser()
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)
  const toast = useToast()
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([])
  const [transferStatusMap, setTransferStatusMap] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [selectedBranchId, setSelectedBranchId] = useState<Id<'branches'> | null>(null)
  
  // Get current user's branch
  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : 'skip'
  )
  const branches = useQuery(api.branches.getBranches) || []
  
  // For Staff: Auto-select their first branch and filter
  useEffect(() => {
    if (userRole === 'staff' && currentUser?.branchIds?.length && !selectedBranchId) {
      setSelectedBranchId(currentUser.branchIds[0])
    }
  }, [userRole, currentUser?.branchIds, selectedBranchId])

  // Track if component has mounted to avoid refetching on initial mount
  const [hasMounted, setHasMounted] = useState(false)
  
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Refetch delivery orders when branch selection changes
  useEffect(() => {
    // Only refetch if component has mounted and branch selection has changed
    // This prevents double-fetching on initial mount
    if (hasMounted) {
      fetchDeliveryOrders(1, search, status)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, hasMounted])
  
  // Get branch prefix for DO numbering
  const getBranchPrefix = (): string | null => {
    if (selectedBranchId) {
      const branch = branches.find((b: any) => b._id === selectedBranchId)
      return branch?.doNumbering || null
    }
    // For staff, use their first assigned branch
    if (userRole === 'staff' && currentUser?.branchIds?.[0]) {
      const branch = branches.find((b: any) => b._id === currentUser.branchIds![0])
      return branch?.doNumbering || null
    }
    return null
  }
  const [selectedDO, setSelectedDO] = useState<DeliveryOrder | null>(null)
  const [doDetail, setDoDetail] = useState<any | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDocKey, setEditingDocKey] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [doFormData, setDoFormData] = useState({
    DocNo: '',
    DocDate: new Date().toISOString().split('T')[0],
    DebtorCode: '',
    Ref: '',
    Description: '',
    SalesAgent: '',
    CurrencyCode: '',
    CurrencyRate: 1,
    PostToStock: 'N',
    TaxEntityName: '', // TaxEntity name (optional)
  })
  const [taxCodes, setTaxCodes] = useState<Array<{ TaxCode: string; Description: string | null; TaxRate: number; IsActive: string }>>([])
  const [customerSelected, setCustomerSelected] = useState(false)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [debtorTypeFilter, setDebtorTypeFilter] = useState<string>('')
  const [registerNoSearch, setRegisterNoSearch] = useState<string>('')
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  type DOLineItem = {
    Seq: number
    ItemCode: string
    Description: string
    UOM: string
    Qty: number
    UnitPrice: number
    Discount: number
    Amount: number
    TaxCode: string
    Tax: number
    NetAmount: number
  }
  const [doLineItems, setDoLineItems] = useState<DOLineItem[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState<{ [key: number]: string }>({})
  const [productSearchResults, setProductSearchResults] = useState<{ [key: number]: any[] }>({})
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalProducts, setModalProducts] = useState<any[]>([])
  const [modalProductSearch, setModalProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  
  // Get branch product templates
  const branchIdForTemplates = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
  const branchProductTemplates = useQuery(
    api.branchProductTemplates.getByBranch,
    branchIdForTemplates ? { branchId: branchIdForTemplates } : 'skip'
  ) || []

  // Fetch tax codes function
  const fetchTaxCodes = async () => {
    try {
      const response = await fetch('/api/autocount/settings/tax-codes')
      if (response.ok) {
        const data = await response.json()
        const codes = data.data || []
        console.log('[DEBUG] Tax codes fetched:', codes.map((tc: any) => ({
          TaxCode: tc.TaxCode,
          TaxRate: tc.TaxRate,
          TaxRateType: typeof tc.TaxRate,
          IsActive: tc.IsActive
        })))
        setTaxCodes(codes)
        return codes
      }
    } catch (err) {
      console.error('Failed to fetch tax codes:', err)
    }
    return []
  }

  // Fetch tax codes on component mount
  useEffect(() => {
    fetchTaxCodes()
  }, [])

  // Format date safely
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    
    try {
      // Handle different date formats
      let date: Date
      
      // If it's already a valid date string, try parsing it
      if (typeof dateString === 'string') {
        // Try ISO format first
        date = new Date(dateString)
        
        // If invalid, try other common formats
        if (isNaN(date.getTime())) {
          // Try YYYY-MM-DD format
          const parts = dateString.split(/[-/]/)
          if (parts.length === 3) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
          } else {
            return '-'
          }
        }
      } else {
        return '-'
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '-'
      }
      
      // Format as locale date string
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch (error) {
      console.error('Error formatting date:', dateString, error)
      return '-'
    }
  }

  // Fetch products for search
  const searchProducts = async (searchTerm: string, lineIndex: number) => {
    if (!searchTerm || searchTerm.length < 2) {
      setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
      return
    }

    try {
      const response = await fetch(`/api/autocount/products-v2?search=${encodeURIComponent(searchTerm)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setProductSearchResults(prev => ({ ...prev, [lineIndex]: data.data || [] }))
      }
    } catch (err) {
      console.error('Failed to search products:', err)
    }
  }

  // Handle product selection
  const handleProductSelect = async (lineIndex: number, product: any) => {
    // Fetch full product details to get UOM and other fields
    try {
      const response = await fetch(`/api/autocount/products/${encodeURIComponent(product.ItemCode)}`)
      if (response.ok) {
        const data = await response.json()
        const fullProduct = data.data
        const updated = [...doLineItems]
        updated[lineIndex] = {
          ...updated[lineIndex],
          ItemCode: fullProduct.ItemCode || product.ItemCode,
          Description: fullProduct.Description || product.Description || '',
          UOM: fullProduct.SalesUOM || fullProduct.UOM || '',
          UnitPrice: fullProduct.Price || product.Price || 0,
          Qty: updated[lineIndex].Qty || 1, // Default to 1 if not set
        }
        // Calculate amount
        const qty = updated[lineIndex].Qty || 1
        const unitPrice = updated[lineIndex].UnitPrice || 0
        const discount = updated[lineIndex].Discount || 0
        updated[lineIndex].Amount = qty * unitPrice * (1 - discount / 100)
        updated[lineIndex].NetAmount = updated[lineIndex].Amount
        
        setDoLineItems(updated)
        setProductSearchTerm(prev => ({ ...prev, [lineIndex]: fullProduct.ItemCode || product.ItemCode }))
        setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
      } else {
        // Fallback to basic product info if detailed fetch fails
    const updated = [...doLineItems]
    updated[lineIndex] = {
      ...updated[lineIndex],
      ItemCode: product.ItemCode,
      Description: product.Description || '',
      UnitPrice: product.Price || 0,
    }
    setDoLineItems(updated)
    setProductSearchTerm(prev => ({ ...prev, [lineIndex]: product.ItemCode }))
    setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
      }
    } catch (err) {
      console.error('Failed to fetch product details:', err)
      // Fallback to basic product info
      const updated = [...doLineItems]
      updated[lineIndex] = {
        ...updated[lineIndex],
        ItemCode: product.ItemCode,
        Description: product.Description || '',
        UnitPrice: product.Price || 0,
      }
      setDoLineItems(updated)
      setProductSearchTerm(prev => ({ ...prev, [lineIndex]: product.ItemCode }))
      setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
    }
  }

  // Fetch delivery orders
  const fetchDeliveryOrders = async (pageNum: number = 1, searchTerm: string = '', statusFilter: string = '', forceRefresh: boolean = false) => {
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
      
      // Add cache-busting timestamp when force refresh is requested
      if (forceRefresh) {
        params.append('_t', Date.now().toString())
      }
      
      // Add branchId filter - use selectedBranchId for Admin/Super Admin, or first branchId for Staff
      const branchIdToFilter = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
      if (branchIdToFilter) {
        params.append('branchId', branchIdToFilter)
      }

      const response = await fetch(`/api/autocount/delivery-orders-v2?${params.toString()}`, {
        cache: forceRefresh ? 'no-store' : 'default',
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache, no-store, must-revalidate' : 'default',
          'Pragma': forceRefresh ? 'no-cache' : 'default',
        }
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch delivery orders')
      }

      const data = await response.json()
      // Normalize the data - map docDate to DocDate if needed
      const normalizedOrders = (data.data || []).map((order: any) => ({
        ...order,
        DocKey: order.DocKey || order.docKey || 0,
        DocDate: order.DocDate || order.docDate || null,
        DocNo: order.DocNo || order.docNo || '',
        DebtorName: order.DebtorName || order.debtorName || null,
        DebtorCode: order.DebtorCode || order.debtorCode || '',
        Attention: order.Attention || order.attention || null,
        Remark4: order.Remark4 || order.remark4 || null,
        Total: order.Total || order.total || null,
        PostToStock: order.PostToStock || order.postToStock || 'N',
        Cancelled: order.Cancelled || order.cancelled || 'N',
        CurrencyCode: order.CurrencyCode || order.currencyCode || 'MYR',
        Status: order.Status || order.status || '',
      }))
      
      // Filter out voided orders (where Cancelled = 'T' or Status = 'Void')
      const activeOrders = normalizedOrders.filter((order: any) => {
        const cancelled = order.Cancelled || order.cancelled || 'N'
        const status = order.Status || order.status || ''
        // Exclude if cancelled is 'T' or status is 'Void'
        return cancelled !== 'T' && status.toUpperCase() !== 'VOID'
      })
      
      setDeliveryOrders(activeOrders)
      setTotal(data.pagination?.total || normalizedOrders.length)
      setPage(pageNum)
      setLoading(false)

      // Fetch transfer status in the background (do not block list display)
      const docKeys = activeOrders.map((o: any) => o.DocKey || o.docKey).filter((k: number) => k > 0)
      if (docKeys.length > 0) {
        fetch(`/api/autocount/delivery-orders-v2/transfer-status?docKeys=${docKeys.join(',')}`)
          .then((trRes) => {
            if (trRes.ok) return trRes.json()
            return { data: {} }
          })
          .then((trData) => {
            const map: Record<number, boolean> = {}
            Object.entries(trData?.data || {}).forEach(([k, v]) => { map[Number(k)] = v === true })
            setTransferStatusMap(map)
          })
          .catch(() => setTransferStatusMap({}))
      } else {
        setTransferStatusMap({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delivery orders')
    } finally {
      setLoading(false)
    }
  }

  // Fetch customers and currencies for dropdowns
  const fetchCustomersList = async () => {
    try {
      const response = await fetch('/api/autocount/customers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        // Show customers that appear active (Y or T) - we'll validate at submission time
        // This matches what the customers page shows as "active"
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

  const fetchCurrenciesList = async () => {
    try {
      const response = await fetch('/api/autocount/dynamic?table=Currency&limit=100')
      if (response.ok) {
        const data = await response.json()
        setCurrencies(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch currencies:', err)
    }
  }

  // Initial load
  useEffect(() => {
    fetchDeliveryOrders(1, search, status)
    fetchCustomersList()
    fetchCurrenciesList()
  }, [])

  // Auto-fill delivery order number and reset form when create modal opens for NEW DO (not edit)
  useEffect(() => {
    if (showCreateModal && !editingDocKey) {
      fetchNextDeliveryOrderNumber()
      // Get current user's name for Sales Agent
      const currentUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : ''
      // Reset form state completely
      setCustomerSelected(false)
      setError(null) // Clear any previous errors
      setDoFormData({
        DocNo: '',
        DocDate: new Date().toISOString().split('T')[0],
        DebtorCode: '',
        Ref: '',
        Description: '',
        SalesAgent: currentUserName,
        CurrencyCode: '',
        CurrencyRate: 1,
        PostToStock: 'N',
        TaxEntityName: '',
      })
      setDoLineItems([])
    }
  }, [showCreateModal, editingDocKey, user])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchDeliveryOrders(1, search, status)
  }

  // Handle status filter change
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    fetchDeliveryOrders(1, search, newStatus)
  }

  // Fetch next delivery order number
  const fetchNextDeliveryOrderNumber = async () => {
    try {
      const response = await fetch('/api/autocount/delivery-orders-v2/next-number')
      if (response.ok) {
        const data = await response.json()
        setDoFormData(prev => ({ ...prev, DocNo: data.data }))
      }
    } catch (err) {
      console.error('Failed to fetch next delivery order number:', err)
    }
  }

  // Handle view delivery order
  const handleViewDO = async (docKey: number | string | undefined) => {
    try {
      // Validate docKey
      if (!docKey) {
        throw new Error('DocKey is required')
      }
      const docKeyNum = typeof docKey === 'string' ? parseInt(docKey, 10) : docKey
      if (isNaN(docKeyNum) || docKeyNum <= 0) {
        throw new Error(`Invalid DocKey: ${docKey}`)
      }
      
      // Use delivery-orders-v2 route (posting-safe IIS API)
      const response = await fetch(`/api/autocount/delivery-orders-v2/${docKeyNum}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch delivery order details')
      }
      const data = await response.json()
      if (!data || !data.data) {
        throw new Error('Invalid response format from server')
      }
      setDoDetail(data.data)
      setSelectedDO(data.data)
    } catch (err) {
      console.error('Error fetching delivery order:', err)
      alert(err instanceof Error ? err.message : 'Failed to load delivery order details')
    }
  }

  // Handle edit delivery order (open create modal pre-filled; show all template lines like create, with DO values merged)
  const handleEditDO = async (docKey: number | string | undefined) => {
    try {
      if (!docKey) return
      const docKeyNum = typeof docKey === 'string' ? parseInt(docKey, 10) : docKey
      if (isNaN(docKeyNum) || docKeyNum <= 0) return

      const response = await fetch(`/api/autocount/delivery-orders-v2/${docKeyNum}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch delivery order')
      }
      const data = await response.json()
      const doData = data?.data
      if (!doData) throw new Error('Invalid response format')

      setDoFormData({
        DocNo: doData.DocNo || '',
        DocDate: (doData.DocDate && typeof doData.DocDate === 'string')
          ? doData.DocDate.split('T')[0]
          : new Date().toISOString().split('T')[0],
        DebtorCode: doData.DebtorCode || '',
        Ref: doData.Ref || '',
        Description: doData.Description || '',
        SalesAgent: doData.SalesAgent || '',
        CurrencyCode: doData.CurrencyCode || 'MYR',
        CurrencyRate: doData.CurrencyRate ?? 1,
        PostToStock: doData.PostToStock || 'N',
        TaxEntityName: doData.TaxEntityName || '',
      })

      // Prefill Step 1: Type (NRIC/Passport) and Customer (Register No) from DO's customer
      let customerForEdit: any = null
      try {
        const custRes = await fetch(`/api/autocount/customers/${encodeURIComponent(doData.DebtorCode || '')}`)
        if (custRes.ok) {
          const custData = await custRes.json()
          customerForEdit = custData.data
          if (customerForEdit) {
            const debtorType = customerForEdit.DebtorType || customerForEdit.debtorType || ''
            setDebtorTypeFilter(debtorType)
            setRegisterNoSearch(customerForEdit.RegisterNo || customerForEdit.registerNo || '')
          }
        }
      } catch {
        // Step 1 will stay empty if customer fetch fails
      }

      const doLinesByItemCode: Record<string, any> = {}
      ;(doData.lineItems || []).forEach((item: any) => {
        const code = (item.ItemCode || '').trim()
        if (code) doLinesByItemCode[code] = item
      })

      let lineItems: DOLineItem[]
      const branchIdForTemplates = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
      if (branchIdForTemplates && branchProductTemplates && branchProductTemplates.length > 0) {
        let currentTaxCodes = taxCodes
        if (currentTaxCodes.length === 0) {
          currentTaxCodes = await fetchTaxCodes()
        }
        const customerDebtorType = customerForEdit
          ? (customerForEdit.DebtorType || customerForEdit.debtorType || '')
          : ''
        const isNRIC = (customerDebtorType || '').toUpperCase() === 'NRIC'

        let productsList: any[] = []
        try {
          const productsResponse = await fetch('/api/autocount/products-v2?limit=1000&activeOnly=true')
          if (productsResponse.ok) {
            const productsData = await productsResponse.json()
            productsList = productsData.data || []
          }
        } catch (err) {
          console.warn('[DO Edit] Failed to load products list:', err)
        }

        const templateLineItems: DOLineItem[] = []
        for (const template of branchProductTemplates) {
          let product: any = productsList.find((p: any) => p.ItemCode === template.itemCode)
          if (!product) {
            try {
              const productResponse = await fetch(`/api/autocount/products/${encodeURIComponent(template.itemCode)}`)
              if (productResponse.ok) {
                const productData = await productResponse.json()
                product = productData.data
              }
            } catch {
              // ignore
            }
          }
          if (!product) {
            product = {
              ItemCode: template.itemCode,
              Description: template.itemCode,
              SalesUOM: 'PCS',
              Price: template.defaultPrice || 0,
            }
          }

          const taxCode = isNRIC ? template.nricTaxCode : template.passportTaxCode
          const taxCodeInfo = taxCode ? currentTaxCodes.find((tc: any) => tc.TaxCode === taxCode && (tc.IsActive === 'Y' || tc.IsActive === 'T')) : null
          const taxRate = taxCodeInfo ? taxCodeInfo.TaxRate : 0

          const doLine = doLinesByItemCode[template.itemCode]
          let qty: number
          let unitPrice: number
          let discount: number
          let amount: number
          let tax: number
          let netAmount: number
          let desc: string
          let uom: string
          let lineTaxCode: string
          if (doLine) {
            qty = doLine.Qty ?? 0
            unitPrice = doLine.UnitPrice ?? 0
            discount = doLine.Discount ?? 0
            amount = doLine.Amount ?? (qty * unitPrice * (1 - (discount || 0) / 100))
            lineTaxCode = doLine.TaxCode || ''
            tax = doLine.Tax ?? 0
            netAmount = doLine.NetAmount ?? amount + tax
            desc = doLine.Description || product.Description || template.itemCode
            uom = doLine.UOM || product.SalesUOM || 'PCS'
          } else {
            qty = template.defaultQty ?? 0
            unitPrice = template.defaultPrice || product.Price || 0
            discount = 0
            amount = qty * unitPrice
            tax = (amount * taxRate) / 100
            netAmount = amount + tax
            lineTaxCode = taxCode || ''
            desc = product.Description || template.itemCode
            uom = product.SalesUOM || 'PCS'
          }
          templateLineItems.push({
            Seq: templateLineItems.length + 1,
            ItemCode: template.itemCode,
            Description: desc,
            UOM: uom,
            Qty: qty,
            UnitPrice: unitPrice,
            Discount: discount,
            Amount: amount,
            TaxCode: lineTaxCode,
            Tax: tax,
            NetAmount: netAmount,
          })
        }

        const templateItemCodes = new Set(branchProductTemplates.map((t: any) => t.itemCode))
        const doOnlyItems = (doData.lineItems || []).filter((item: any) => !templateItemCodes.has((item.ItemCode || '').trim()))
        doOnlyItems.forEach((item: any) => {
          const qty = item.Qty ?? 0
          const unitPrice = item.UnitPrice ?? 0
          const discount = item.Discount ?? 0
          const amount = item.Amount ?? qty * unitPrice * (1 - (discount || 0) / 100)
          const tax = item.Tax ?? 0
          const netAmount = item.NetAmount ?? amount + tax
          templateLineItems.push({
            Seq: templateLineItems.length + 1,
            ItemCode: item.ItemCode || '',
            Description: item.Description || '',
            UOM: item.UOM || '',
            Qty: qty,
            UnitPrice: unitPrice,
            Discount: discount,
            Amount: amount,
            TaxCode: item.TaxCode || '',
            Tax: tax,
            NetAmount: netAmount,
          })
        })
        lineItems = templateLineItems
      } else {
        lineItems = (doData.lineItems || []).map((item: any, index: number) => ({
          Seq: index + 1,
          ItemCode: item.ItemCode || '',
          Description: item.Description || '',
          UOM: item.UOM || '',
          Qty: item.Qty ?? 0,
          UnitPrice: item.UnitPrice ?? 0,
          Discount: item.Discount ?? 0,
          Amount: item.Amount ?? (item.Qty ?? 0) * (item.UnitPrice ?? 0),
          TaxCode: item.TaxCode || '',
          Tax: item.Tax ?? 0,
          NetAmount: item.NetAmount ?? item.Amount ?? (item.Qty ?? 0) * (item.UnitPrice ?? 0),
        }))
      }

      setDoLineItems(lineItems)
      setCustomerSelected(true)
      setSelectedCustomerName(doData.DebtorName || doData.DebtorCode || '')
      setEditingDocKey(docKeyNum)
      setError(null)
      setShowCreateModal(true)
    } catch (err) {
      console.error('Error loading delivery order for edit:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load delivery order')
    }
  }

  // Handle print delivery order
  const handlePrintDO = async (doOrder: DeliveryOrder) => {
    try {
      // Fetch full DO details
      const docKeyNum = typeof doOrder.DocKey === 'string' ? parseInt(doOrder.DocKey, 10) : doOrder.DocKey
      if (isNaN(docKeyNum) || docKeyNum <= 0) {
        throw new Error(`Invalid DocKey: ${doOrder.DocKey}`)
      }

      const response = await fetch(`/api/autocount/delivery-orders-v2/${docKeyNum}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch delivery order details')
      }
      const data = await response.json()
      if (!data || !data.data) {
        throw new Error('Invalid response format from server')
      }

      const doData = data.data

      // Open print window with 80mm thermal paper width
      const printWindow = window.open('', '_blank', 'width=80mm,height=auto')
      if (!printWindow) {
        alert('Please allow popups to print delivery orders')
        return
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Delivery Order ${doData.DocNo || ''}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
            body {
              width: 80mm;
              margin: 0;
              padding: 8px;
              font-family: Arial, sans-serif;
              font-size: 10px;
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .info {
              margin: 4px 0;
            }
            .line-items {
              margin-top: 8px;
              border-top: 1px solid #000;
              padding-top: 8px;
            }
            .line-item {
              margin: 4px 0;
              padding: 4px 0;
              border-bottom: 1px dashed #ccc;
            }
            .total {
              margin-top: 8px;
              border-top: 1px solid #000;
              padding-top: 8px;
              text-align: right;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>DELIVERY ORDER</h2>
            <p>${doData.DocNo || ''}</p>
          </div>
          <div class="info">
            <p><strong>Date:</strong> ${doData.DocDate ? new Date(doData.DocDate).toLocaleDateString('en-GB') : ''}</p>
            <p><strong>Customer:</strong> ${doData.DebtorName || doData.DebtorCode || ''}</p>
            <p><strong>Customer Code:</strong> ${doData.DebtorCode || ''}</p>
          </div>
          <div class="line-items">
            <h3>Items:</h3>
            ${(doData.lineItems || []).map((item: any) => `
              <div class="line-item">
                <p><strong>${item.ItemCode || ''}</strong> - ${item.Description || ''}</p>
                <p>Qty: ${item.Qty || 0} x RM${(item.UnitPrice || 0).toFixed(2)} = RM${(item.Amount || 0).toFixed(2)}</p>
              </div>
            `).join('')}
          </div>
          <div class="total">
            <p>Total: RM${(doData.Total || 0).toFixed(2)}</p>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (err) {
      console.error('Error printing delivery order:', err)
      alert(err instanceof Error ? err.message : 'Failed to print delivery order')
    }
  }


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
      // Reset auto-filled fields
      setDoFormData(prev => ({
        ...prev,
        DebtorCode: '',
        CurrencyCode: '',
        CurrencyRate: 1,
        SalesAgent: '',
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
          setDoFormData(prev => ({
            ...prev,
            DebtorCode: '',
            CurrencyCode: '',
            CurrencyRate: 1,
            SalesAgent: '',
          }))
          setLoadingCustomer(false)
          return
        }
        
        // Get currency code from customer, default to MYR if not set
        const customerCurrencyCode = customer.CurrencyCode || 'MYR'
        
        // Find currency rate from currencies list if currency code is available
        let currencyRate = 1
        if (customerCurrencyCode && currencies.length > 0) {
          const currency = currencies.find(c => c.CurrencyCode === customerCurrencyCode)
          currencyRate = currency?.CurrencyRate || 1
        }
        
        // Get current user's name for Sales Agent
        const currentUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : ''
        
        // Auto-fill fields from customer data (but don't show them in the form)
        setDoFormData(prev => ({
          ...prev,
          DebtorCode: debtorCode,
          CurrencyCode: customerCurrencyCode,
          CurrencyRate: currencyRate,
          SalesAgent: currentUserName, // Set to current user name instead of customer's sales agent
        }))
        setCustomerSelected(true)
        setSelectedCustomerName(customer.CompanyName || customer.AccNo)
        setShowCustomerSuggestions(false)
        setError(null) // Clear any previous errors
        
        // When editing a DO, do not reset line items when user changes customer
        if (editingDocKey) {
          setLoadingCustomer(false)
          return
        }
        
        // Load branch product templates and populate line items (create mode only)
        const branchIdForTemplates = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
        if (branchIdForTemplates && branchProductTemplates && branchProductTemplates.length > 0) {
          // Ensure tax codes are loaded before applying templates
          let currentTaxCodes = taxCodes
          if (currentTaxCodes.length === 0) {
            console.log('[DO Create] Tax codes not loaded yet, fetching...')
            currentTaxCodes = await fetchTaxCodes()
          }
          
          // Get customer's DebtorType to determine which tax code to use
          const customerDebtorType = customer.DebtorType || customer.debtorType || ''
          const isNRIC = customerDebtorType.toUpperCase() === 'NRIC'
          console.log('[DO Create] Loading templates for customer', { 
            debtorCode: debtorCode, 
            debtorType: customerDebtorType, 
            isNRIC,
            templatesCount: branchProductTemplates.length,
            taxCodesCount: currentTaxCodes.length
          })
          
          // Fetch products list once (more efficient than fetching individually)
          let productsList: any[] = []
          try {
            const productsResponse = await fetch('/api/autocount/products-v2?limit=1000&activeOnly=true')
            if (productsResponse.ok) {
              const productsData = await productsResponse.json()
              productsList = productsData.data || []
              console.log('[DO Create] Loaded products list:', productsList.length)
            }
          } catch (err) {
            console.warn('[DO Create] Failed to load products list:', err)
          }
          
          // Fetch product details for each template item
          const templateLineItems: DOLineItem[] = []
          for (const template of branchProductTemplates) {
            try {
              console.log('[DO Create] Processing template:', template.itemCode)
              
              // Try to get product from products list first (more efficient and avoids encoding issues)
              let product: any = productsList.find((p: any) => p.ItemCode === template.itemCode)
              
              // Fallback: fetch individual product if not found in list
              if (!product) {
                try {
                  const productResponse = await fetch(`/api/autocount/products/${encodeURIComponent(template.itemCode)}`)
                  if (productResponse.ok) {
                    const productData = await productResponse.json()
                    product = productData.data
                  }
                } catch (fetchErr) {
                  console.warn(`[DO Create] Failed to fetch product ${template.itemCode}:`, fetchErr)
                }
              }
              
              // If still no product, create minimal product object so template still shows
              if (!product) {
                console.warn(`[DO Create] Product ${template.itemCode} not found, creating minimal product object`)
                product = {
                  ItemCode: template.itemCode,
                  Description: template.itemCode,
                  SalesUOM: 'PCS',
                  Price: template.defaultPrice || 0
                }
              }
              
              if (product) {
                // Determine tax code based on customer's DebtorType
                const taxCode = isNRIC ? template.nricTaxCode : template.passportTaxCode
                // Accept both 'Y' and 'T' as active (matching settings page logic)
                const taxCodeInfo = taxCode ? currentTaxCodes.find(tc => tc.TaxCode === taxCode && (tc.IsActive === 'Y' || tc.IsActive === 'T')) : null
                const taxRate = taxCodeInfo ? taxCodeInfo.TaxRate : 0
                
                console.log('[DO Create] Template tax code lookup', {
                  itemCode: template.itemCode,
                  isNRIC,
                  taxCode,
                  taxCodeInfo: taxCodeInfo ? { TaxCode: taxCodeInfo.TaxCode, TaxRate: taxCodeInfo.TaxRate, IsActive: taxCodeInfo.IsActive } : null,
                  availableTaxCodes: currentTaxCodes.map(tc => `${tc.TaxCode}(${tc.IsActive})`)
                })
                
                // Calculate amounts (default quantity always 0)
                const qty = template.defaultQty ?? 0
                const unitPrice = template.defaultPrice || product.Price || 0
                const amount = qty * unitPrice
                const tax = (amount * taxRate) / 100
                const netAmount = amount + tax
                
                templateLineItems.push({
                  Seq: templateLineItems.length + 1,
                  ItemCode: template.itemCode,
                  Description: product.Description || template.itemCode,
                  UOM: product.SalesUOM || 'PCS',
                  Qty: qty,
                  UnitPrice: unitPrice,
                  Discount: 0,
                  Amount: amount,
                  TaxCode: taxCode || '',
                  Tax: tax,
                  NetAmount: netAmount,
                })
                console.log('[DO Create] Added template line item:', template.itemCode)
              }
            } catch (err) {
              console.error(`[DO Create] Error processing template ${template.itemCode}:`, err)
              // Continue with other templates even if one fails
            }
          }
          
          console.log('[DO Create] Template line items created:', templateLineItems.length)
          // Set the line items from templates
          if (templateLineItems.length > 0) {
            setDoLineItems(templateLineItems)
          } else {
            console.warn('[DO Create] No template line items were created')
          }
        } else {
          console.log('[DO Create] Templates not loaded:', {
            branchIdForTemplates,
            branchProductTemplates: branchProductTemplates?.length || 0,
            hasTemplates: !!branchProductTemplates && branchProductTemplates.length > 0
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || errorData.message || `Customer "${debtorCode}" not found. Please select a valid customer.`)
        setCustomerSelected(false)
        setDoFormData(prev => ({
          ...prev,
          DebtorCode: '',
          CurrencyCode: '',
          CurrencyRate: 1,
          SalesAgent: '',
        }))
      }
    } catch (err) {
      console.error('Error fetching customer:', err)
      setError(`Failed to load customer details: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setCustomerSelected(false)
      setDoFormData(prev => ({
        ...prev,
        DebtorCode: '',
        CurrencyCode: '',
        CurrencyRate: 1,
        SalesAgent: '',
      }))
    } finally {
      setLoadingCustomer(false)
    }
  }

  // Handle create delivery order
  const handleCreateDO = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[DO Create] Form submitted', { doFormData, doLineItems })
    setSaving(true)
    setError(null)

    try {
      // Validate required fields
      const missingFields: string[] = []
      if (!doFormData.DocDate) missingFields.push('DO Date')
      if (!doFormData.DebtorCode) missingFields.push('Customer')
      if (!doFormData.CurrencyCode || doFormData.CurrencyCode.trim() === '') {
        missingFields.push('Currency Code')
      }
      if (!doFormData.CurrencyRate || doFormData.CurrencyRate <= 0) {
        missingFields.push('Currency Rate')
      }
      // Only send line items with qty > 0
      const lineItemsToSend = doLineItems.filter((item) => (item.Qty ?? 0) > 0)

      if (lineItemsToSend.length === 0) {
        missingFields.push('Line Items (at least one item with quantity > 0 is required)')
      }

      // Validate line items (only those being sent)
      const invalidLineItems: string[] = []
      lineItemsToSend.forEach((item, index) => {
        if (!item.ItemCode || item.ItemCode.trim() === '') {
          invalidLineItems.push(`Line ${index + 1}: Item Code is required`)
        }
        if (!item.UnitPrice || item.UnitPrice <= 0) {
          invalidLineItems.push(`Line ${index + 1}: Unit Price must be greater than 0`)
        }
      })

      if (missingFields.length > 0 || invalidLineItems.length > 0) {
        const allErrors = [...missingFields, ...invalidLineItems]
        console.warn('[DO Create] Validation failed', { missingFields, invalidLineItems, doFormData, doLineItems })
        setError(`Please fix the following: ${allErrors.join(', ')}`)
        setSaving(false)
        return
      }

      // Final validation: Verify customer exists and is active (backend only accepts IsActive = 'Y')
      if (doFormData.DebtorCode) {
        try {
          const customerCheckResponse = await fetch(`/api/autocount/customers/${encodeURIComponent(doFormData.DebtorCode)}`)
          if (customerCheckResponse.ok) {
            const customerCheckData = await customerCheckResponse.json()
            const customer = customerCheckData.data
            console.log('[DO Create] Customer validation check:', { 
              debtorCode: doFormData.DebtorCode, 
              isActive: customer?.IsActive,
              isActiveType: typeof customer?.IsActive,
              customer: customer 
            })
            if (!customer) {
              setError(`Customer "${doFormData.DebtorCode}" not found. Please select a valid customer.`)
              setSaving(false)
              return
            }
            // Check if customer is active using same logic as customers table (Y or T = active)
            const isActive = customer.IsActive === 'Y' || customer.IsActive === 'T'
            console.log('[DO Create] Customer active check:', {
              debtorCode: doFormData.DebtorCode,
              isActiveValue: customer.IsActive,
              isActive: isActive
            })
            if (!isActive) {
              setError(`Customer "${doFormData.DebtorCode}" is inactive (IsActive = '${customer.IsActive || 'null/undefined'}'). Please select an active customer.`)
              setSaving(false)
              return
            }
            // Backend only accepts IsActive = 'Y', so warn if customer has 'T'
            if (customer.IsActive === 'T') {
              console.warn('[DO Create] Customer has IsActive = "T", backend may reject. Backend only accepts IsActive = "Y"')
              // Continue anyway - let backend validate
            }
          } else {
            const errorData = await customerCheckResponse.json().catch(() => ({}))
            setError(`Customer "${doFormData.DebtorCode}" not found: ${errorData.error || errorData.message || 'Customer does not exist'}`)
            setSaving(false)
            return
          }
        } catch (err) {
          console.error('Error verifying customer:', err)
          // Continue with submission - backend will validate, but log the error
        }
      }

      // Ensure CurrencyCode has a default value if somehow missing
      const currencyCode = doFormData.CurrencyCode || 'MYR'
      const currencyRate = doFormData.CurrencyRate || 1

      // Get branchId and branchPrefix
      const branchId = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
      const branchPrefix = getBranchPrefix()

      const requestBody = {
        header: {
          DocNo: doFormData.DocNo,
          DocDate: doFormData.DocDate,
          DebtorCode: doFormData.DebtorCode,
          Ref: doFormData.Ref || '',
          Description: doFormData.Description || '',
          SalesAgent: doFormData.SalesAgent || '',
          CurrencyCode: currencyCode,
          CurrencyRate: currencyRate,
          PostToStock: doFormData.PostToStock,
          TaxEntityName: doFormData.TaxEntityName || null,
          BranchPrefix: branchPrefix, // Still needed for DO numbering
          BranchId: branchId, // Store branchId for filtering
        },
        lineItems: lineItemsToSend.map((item, index) => ({
          Seq: index + 1,
          ItemCode: item.ItemCode,
          Description: item.Description,
          UOM: item.UOM,
          Qty: item.Qty ?? 0,
          UnitPrice: item.UnitPrice || 0,
          Discount: item.Discount || 0,
          Amount: item.Amount || 0,
          TaxCode: item.TaxCode || null,
          Tax: item.Tax || 0,
          NetAmount: item.NetAmount || item.Amount || 0,
        })),
      }
      console.log(editingDocKey ? '[DO Update]' : '[DO Create]', 'Sending request to API', requestBody)

      const url = editingDocKey
        ? `/api/autocount/delivery-orders-v2/${editingDocKey}`
        : '/api/autocount/delivery-orders-v2'
      const response = await fetch(url, {
        method: editingDocKey ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log(editingDocKey ? '[DO Update]' : '[DO Create]', 'API response status', response.status, response.statusText)

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { error: `Server error: ${response.status} ${response.statusText}` }
        }
        console.error(editingDocKey ? '[DO Update]' : '[DO Create]', 'API error', errorData)
        
        let errorMessage = errorData.message || errorData.error || errorData.details || (editingDocKey ? 'Failed to update delivery order' : 'Failed to create delivery order')
        
        if (errorMessage.includes('Debtor') && (errorMessage.includes('not found') || errorMessage.includes('inactive'))) {
          errorMessage = `Customer validation failed: ${errorMessage}. Please select a different active customer.`
        } else if (errorMessage.includes('Item') && (errorMessage.includes('not found') || errorMessage.includes('inactive'))) {
          errorMessage = `Product validation failed: ${errorMessage}. Please select a different active product.`
        }
        
        throw new Error(errorMessage)
      }

      const responseData = await response.json()
      console.log(editingDocKey ? '[DO Update]' : '[DO Create]', 'Success', responseData)

      const isUpdate = !!editingDocKey
      setShowCreateModal(false)
      setEditingDocKey(null)
      console.log(isUpdate ? '[DO Update]' : '[DO Create]', 'Resetting form data')
      setDebtorTypeFilter('')
      setRegisterNoSearch('')
      setFilteredCustomers([])
      setDoFormData({
        DocNo: '',
        DocDate: new Date().toISOString().split('T')[0],
        DebtorCode: '',
        Ref: '',
        Description: '',
        SalesAgent: '',
        CurrencyCode: '',
        CurrencyRate: 1,
        PostToStock: 'N',
        TaxEntityName: '',
      })
      setDoLineItems([])
      setCustomerSelected(false)
      await fetchDeliveryOrders(page, search, status)
      toast.success(isUpdate ? 'Delivery order updated successfully' : 'Delivery order created successfully')
    } catch (err) {
      console.error('[DO Create] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to create delivery order')
    } finally {
      setSaving(false)
      console.log('[DO Create] Form submission completed')
    }
  }

  // Fetch products for modal
  const fetchModalProducts = async (searchTerm: string = '') => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        activeOnly: 'true',
      })
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      const response = await fetch(`/api/autocount/products-v2?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setModalProducts(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Add line item - opens product selection modal
  const addDOLineItem = () => {
    setShowProductModal(true)
    setModalProductSearch('')
    fetchModalProducts()
  }

  // Handle product selection from modal
  const handleModalProductSelect = async (product: any) => {
    try {
      // Fetch full product details
      const response = await fetch(`/api/autocount/products/${encodeURIComponent(product.ItemCode)}`)
      let fullProduct = product
      if (response.ok) {
        const data = await response.json()
        fullProduct = data.data || product
      }

      const qty = 0
      const unitPrice = fullProduct.Price || product.Price || 0
      const discount = 0
      const amount = qty * unitPrice * (1 - discount / 100)
      const taxCode = fullProduct.TaxCode || product.TaxCode || ''
      // Calculate tax based on TaxCode
      const tax = calculateTaxForLine(amount, taxCode)

    const newItem = {
      Seq: doLineItems.length + 1,
        ItemCode: fullProduct.ItemCode || product.ItemCode,
        Description: fullProduct.Description || product.Description || '',
        UOM: fullProduct.SalesUOM || fullProduct.UOM || '',
        Qty: 0, // Default quantity to 0
        UnitPrice: unitPrice,
        Discount: discount,
        Amount: amount,
        TaxCode: taxCode,
        Tax: tax,
        NetAmount: amount + tax,
      }
      
      setDoLineItems([...doLineItems, newItem])
      setShowProductModal(false)
      setModalProductSearch('')
    } catch (err) {
      console.error('Failed to fetch product details:', err)
      // Fallback to basic product info
      const qty = 0
      const unitPrice = product.Price || 0
      const amount = qty * unitPrice
      const taxCode = product.TaxCode || ''
      // Calculate tax based on TaxCode
      const tax = calculateTaxForLine(amount, taxCode)

      const newItem = {
        Seq: doLineItems.length + 1,
        ItemCode: product.ItemCode,
        Description: product.Description || '',
      UOM: '',
        Qty: 0, // Default quantity to 0
        UnitPrice: unitPrice,
      Discount: 0,
        Amount: amount,
        TaxCode: taxCode,
        Tax: tax,
        NetAmount: amount + tax,
    }
    setDoLineItems([...doLineItems, newItem])
      setShowProductModal(false)
      setModalProductSearch('')
    }
  }

  // Remove line item
  const removeDOLineItem = (index: number) => {
    console.log('[DO Create] Removing line item', { index, item: doLineItems[index] })
    setDoLineItems(doLineItems.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      Seq: i + 1,
    })))
  }

  // Calculate tax for a line item based on TaxCode
  const calculateTaxForLine = (amount: number, taxCode: string): number => {
    if (!taxCode || amount <= 0) return 0
    // Accept both 'Y' and 'T' as active (matching settings page logic)
    const taxCodeInfo = taxCodes.find(tc => tc.TaxCode === taxCode && (tc.IsActive === 'Y' || tc.IsActive === 'T'))
    if (!taxCodeInfo) {
      console.log('[DO Create] Tax code not found or inactive:', taxCode, 'Available codes:', taxCodes.map(tc => `${tc.TaxCode}(${tc.IsActive})`))
      return 0
    }
    return amount * (taxCodeInfo.TaxRate / 100)
  }

  // Update line item
  const updateDOLineItem = (index: number, field: keyof DOLineItem, value: any) => {
    console.log('[DO Create] Updating line item', { index, field, value, oldValue: doLineItems[index]?.[field] })
    const updated = [...doLineItems]
    updated[index] = { ...updated[index], [field]: value }
    
    // Calculate amount and net amount
    if (field === 'Qty' || field === 'UnitPrice' || field === 'Discount') {
      const qty = updated[index].Qty || 0
      const unitPrice = updated[index].UnitPrice || 0
      const discount = updated[index].Discount || 0
      const amount = qty * unitPrice * (1 - discount / 100)
      updated[index].Amount = amount
      // Recalculate tax based on current TaxCode
      const tax = calculateTaxForLine(amount, updated[index].TaxCode || '')
      updated[index].Tax = tax
      updated[index].NetAmount = amount + tax
      console.log('[DO Create] Recalculated amounts', { 
        index, 
        qty, 
        unitPrice, 
        discount, 
        amount, 
        tax,
        netAmount: updated[index].NetAmount
      })
    }
    
    // When TaxCode changes, recalculate tax
    if (field === 'TaxCode') {
      const amount = updated[index].Amount || 0
      const tax = calculateTaxForLine(amount, value || '')
      updated[index].Tax = tax
      updated[index].NetAmount = amount + tax
      console.log('[DO Create] Recalculated tax after TaxCode change', { 
        index, 
        taxCode: value,
        amount, 
        tax, 
        netAmount: updated[index].NetAmount 
      })
    }
    
    // Manual tax override (if user manually changes tax)
    if (field === 'Tax') {
      updated[index].NetAmount = (updated[index].Amount || 0) + (updated[index].Tax || 0)
      console.log('[DO Create] Recalculated net amount after tax change', { 
        index, 
        amount: updated[index].Amount, 
        tax: updated[index].Tax, 
        netAmount: updated[index].NetAmount 
      })
    }
    
    setDoLineItems(updated)
  }

  // Handle delete delivery order (void)
  const handleDeleteDO = async (docKey: number, docNo: string) => {
    if (!confirm(`Are you sure you want to void delivery order ${docNo}?`)) {
      return
    }

    try {
      // Use delivery-orders-v2 DELETE endpoint (voids the delivery order)
      const response = await fetch(`/api/autocount/delivery-orders-v2/${docKey}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to void delivery order')
      }

      await fetchDeliveryOrders(page, search, status)
      toast.success('Delivery order voided successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void delivery order')
    }
  }

  // Get delivery status badge (Transferred = any line has been invoiced per DODtl.ToQty)
  const getDeliveryStatusBadge = (order: DeliveryOrder) => {
    if (order.Cancelled === 'Y') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Overdue
        </span>
      )
    }
    if (transferStatusMap[order.DocKey]) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-100 dark:border-violet-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
          Transferred
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Active
      </span>
    )
  }


  return (
    <>
      <PageHeader
        title="Delivery Orders"
        description="Efficiently manage and track your customer shipments."
        {...(selectedBranchId !== null ? {
          actionLabel: "Create Order",
          actionIcon: "add",
          onAction: () => {
            // Get current user's name for Sales Agent
            const currentUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '' : ''
            setDoFormData({
              DocNo: '',
              DocDate: new Date().toISOString().split('T')[0],
              DebtorCode: '',
              Ref: '',
              Description: '',
              SalesAgent: currentUserName,
              CurrencyCode: '',
              CurrencyRate: 1,
              PostToStock: 'N',
              TaxEntityName: '',
            })
            setDoLineItems([])
            setShowCreateModal(true)
          }
        } : {})}
      />
      <div className="px-8 pb-8 flex-1">
        {/* Branch Tabs - Show for Admin and Super Admin */}
        {(permissions.canCreateBranch || (userRole === 'staff' && currentUser?.branchIds?.length)) && branches.length > 0 && (
          <BranchTabs
            selectedBranchId={selectedBranchId}
            onBranchChange={(branchId) => {
              setSelectedBranchId(branchId)
              setPage(1) // Reset to page 1 when switching branches
            }}
            restrictToBranchIds={userRole === 'staff' ? (currentUser?.branchIds ?? null) : null}
          />
        )}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
      {/* Search and Filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <form onSubmit={handleSearch} className="w-full">
                <input
                  type="text"
                  placeholder="Search by DO number, customer, or total..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-slate-200"
                />
              </form>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  className="pl-4 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary dark:text-slate-200 min-w-[140px]"
                >
                  <option>All Customers</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
              </div>
              <div className="relative">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                  className="pl-4 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary dark:text-slate-200 min-w-[120px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="posted">Posted</option>
                <option value="cancelled">Cancelled</option>
              </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
            </div>
              <button
                onClick={() => fetchDeliveryOrders(page, search, status, true)}
                className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh Table (Force Reload)"
                disabled={loading}
              >
                <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
              </button>
          </div>
          </div>

          {error && (
            <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading delivery orders...</div>
          ) : deliveryOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {search || status ? 'No delivery orders found matching your filters' : 'No delivery orders found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">DO No</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient Name</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payee Name</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created By</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Delivery Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {deliveryOrders.filter((doOrder) => !transferStatusMap[doOrder.DocKey]).map((doOrder) => (
                      <tr key={doOrder.DocKey} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-semibold text-sm text-primary">{doOrder.DocNo || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(doOrder.DocDate)}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{doOrder.DebtorName || doOrder.DebtorCode || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{doOrder.Attention || '-'}</td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {doOrder.Total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: doOrder.CurrencyCode || 'MYR',
                              }).format(Number(doOrder.Total))
                            : '-'}
                        </td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 uppercase">
                            {doOrder.PostToStock === 'Y' ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{doOrder.Remark4 || '-'}</td>
                        <td className="px-6 py-3">{getDeliveryStatusBadge(doOrder)}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="row-actions flex items-center justify-end gap-1">
                            {(doOrder.Status === 'Draft' || doOrder.DocStatus === 'D' || doOrder.Status === 'Unknown') && !transferStatusMap[doOrder.DocKey] && (
                              <button
                                onClick={() => handleEditDO(doOrder.DocKey)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-xl">edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDO(doOrder.DocKey)}
                              disabled={!doOrder.DocKey || doOrder.DocKey <= 0}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!doOrder.DocKey || doOrder.DocKey <= 0 ? "DocKey is missing or invalid" : "View Detail"}
                            >
                              <span className="material-symbols-outlined text-xl">visibility</span>
                            </button>
                            <button
                              onClick={() => handlePrintDO(doOrder)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                              title="Print"
                            >
                              <span className="material-symbols-outlined text-xl">print</span>
                            </button>
                            {doOrder.Cancelled !== 'Y' && (
                              <button
                                  onClick={() => handleDeleteDO(doOrder.DocKey, doOrder.DocNo)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                title="Delete"
                                >
                                <span className="material-symbols-outlined text-xl">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchDeliveryOrders(page - 1, search, status)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-not-allowed border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-white bg-[#1e40af] rounded-lg border border-[#1e40af] shadow-sm">
                    {page}
                  </button>
                  <button
                    onClick={() => fetchDeliveryOrders(page + 1, search, status)}
                    disabled={page >= Math.ceil(total / limit)}
                    className="px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* View Delivery Order Modal */}
      {doDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Delivery Order Details: {doDetail.DocNo}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setDoDetail(null)}>
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
                    <Label className="text-sm font-semibold">DO Number</Label>
                    <p className="text-sm">{doDetail.DocNo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Date</Label>
                    <p className="text-sm">{formatDate(doDetail.DocDate || doDetail.docDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Customer</Label>
                    <p className="text-sm">
                      {doDetail.customer?.CompanyName || doDetail.DebtorCode}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Currency</Label>
                    <p className="text-sm">{doDetail.CurrencyCode} (Rate: {doDetail.CurrencyRate})</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Post to Stock</Label>
                    <p className="text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          doDetail.PostToStock === 'Y'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {doDetail.PostToStock === 'Y' ? 'Yes' : 'No'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Status</Label>
                    <p className="text-sm">
                      {doDetail.Cancelled === 'Y' ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          Cancelled
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Line Items</Label>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 font-semibold text-sm">Seq</th>
                          <th className="text-left p-2 font-semibold text-sm">Description</th>
                          <th className="text-left p-2 font-semibold text-sm">UOM</th>
                          <th className="text-right p-2 font-semibold text-sm">Qty</th>
                          <th className="text-right p-2 font-semibold text-sm">Unit Price</th>
                          <th className="text-right p-2 font-semibold text-sm">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doDetail.lineItems && doDetail.lineItems.length > 0 ? (
                          doDetail.lineItems.map((item: any) => (
                            <tr key={item.DtlKey} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm">{item.Seq}</td>
                              <td className="p-2 text-sm">{item.Description || '-'}</td>
                              <td className="p-2 text-sm">{item.UOM || '-'}</td>
                              <td className="p-2 text-sm text-right">{item.Qty || '-'}</td>
                              <td className="p-2 text-sm text-right">
                                {item.UnitPrice
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: doDetail.CurrencyCode || 'MYR',
                                    }).format(Number(item.UnitPrice))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {item.SubTotal
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: doDetail.CurrencyCode || 'MYR',
                                    }).format(Number(item.SubTotal))
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">
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
                        <Label className="text-sm font-semibold">Net Total:</Label>
                        <p className="text-sm">
                          {doDetail.NetTotal
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: doDetail.CurrencyCode || 'MYR',
                              }).format(Number(doDetail.NetTotal))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Tax:</Label>
                        <p className="text-sm">
                          {doDetail.Tax
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: doDetail.CurrencyCode || 'MYR',
                              }).format(Number(doDetail.Tax))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-sm font-bold">Total:</Label>
                        <p className="text-sm font-bold">
                          {doDetail.Total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: doDetail.CurrencyCode || 'MYR',
                              }).format(Number(doDetail.Total))
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

      {/* Create Delivery Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingDocKey ? 'Edit Delivery Order' : 'Create New Delivery Order'}</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowCreateModal(false)
                  setEditingDocKey(null)
                  setDebtorTypeFilter('')
                  setRegisterNoSearch('')
                  setFilteredCustomers([])
                  setCustomerSelected(false)
                  setShowCustomerSuggestions(false)
                  setSelectedCustomerName('')
                  setDoFormData({
                    DocNo: '',
                    DocDate: new Date().toISOString().split('T')[0],
                    DebtorCode: '',
                    Ref: '',
                    Description: '',
                    SalesAgent: '',
                    CurrencyCode: '',
                    CurrencyRate: 1,
                    PostToStock: 'N',
                    TaxEntityName: '',
                  })
                  setDoLineItems([])
                }}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateDO} className="space-y-6">
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
                          setDoFormData(prev => ({ ...prev, DebtorCode: '' }))
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
                            setDoFormData(prev => ({ ...prev, DebtorCode: '' }))
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
                              <span className="font-semibold">Selected:</span> {selectedCustomerName} ({doFormData.DebtorCode})
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

                {/* Step 2: Additional Fields (only shown after customer selection) */}
                {customerSelected && (
                  <>
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold mb-4">Step 2: Order Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {/* DO Number - Hidden (auto-generated) */}
                        <input type="hidden" id="do-DocNo" value={doFormData.DocNo} />
                        {/* Post to Stock - Hidden (defaults to 'N') */}
                        <input type="hidden" id="do-PostToStock" value={doFormData.PostToStock} />
                        <div>
                          <Label htmlFor="do-DocDate">DO Date * (DD/MM/YYYY)</Label>
                          <Input
                            id="do-DocDate"
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={formatISODateToDDMMYYYY(doFormData.DocDate)}
                            onChange={(e) => {
                              const raw = e.target.value.trim()
                              if (raw === '') {
                                setDoFormData({ ...doFormData, DocDate: new Date().toISOString().split('T')[0] })
                                return
                              }
                              const iso = parseDDMMYYYYToISO(e.target.value)
                              if (iso !== null) setDoFormData({ ...doFormData, DocDate: iso })
                            }}
                            required
                          />
                        </div>
                        {/* Hidden fields - CurrencyCode, CurrencyRate, and SalesAgent are auto-filled but not shown */}
                        <input type="hidden" value={doFormData.CurrencyCode} />
                        <input type="hidden" value={doFormData.CurrencyRate} />
                        <input type="hidden" value={doFormData.SalesAgent} />
                        <div>
                          <Label htmlFor="do-Branch">Branch</Label>
                          <Input
                            id="do-Branch"
                            value={
                              (() => {
                                const branchId = selectedBranchId || (userRole === 'staff' && currentUser?.branchIds?.[0] ? currentUser.branchIds[0] : null)
                                const branch = branches.find((b: { _id: typeof selectedBranchId }) => b._id === branchId)
                                return branch ? (branch.alias || branch.branchName) : '—'
                              })()
                            }
                            readOnly
                            className="bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Line Items (only shown after customer selection) */}
                {customerSelected && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-lg font-semibold">Step 3: Line Items</Label>
                      <Button type="button" onClick={addDOLineItem} variant="outline" size="sm">
                        + Add Line Item
                      </Button>
                    </div>
                  {doLineItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold text-sm">Description</th>
                            <th className="text-left p-2 font-semibold text-sm">UOM</th>
                            <th className="text-right p-2 font-semibold text-sm">Qty</th>
                            <th className="text-right p-2 font-semibold text-sm">Unit Price</th>
                            <th className="text-right p-2 font-semibold text-sm">Discount %</th>
                            <th className="text-right p-2 font-semibold text-sm">Amount</th>
                            <th className="text-left p-2 font-semibold text-sm">Tax Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doLineItems.map((item, index) => (
                            <tr
                              key={`line-item-${index}-${item.ItemCode || index}`}
                              className={`border-b ${(item.Qty ?? 0) > 0 ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : ''}`}
                            >
                              <td className="p-2 min-w-[120px]">
                                <span className="text-sm text-gray-900 block break-words whitespace-normal">
                                  {item.Description || '-'}
                                </span>
                              </td>
                              <td className="p-2">
                                <span className="text-xs text-gray-700 whitespace-nowrap" title={item.UOM || ''}>
                                  {item.UOM || '—'}
                                </span>
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={() => updateDOLineItem(index, 'Qty', Math.max(0, Math.floor((item.Qty ?? 0) - 1)))}
                                  >
                                    −
                                  </Button>
                                  <Input
                                    type="number"
                                    step="1"
                                    min={0}
                                    value={item.Qty ?? 0}
                                    onChange={(e) => updateDOLineItem(index, 'Qty', Math.max(0, Math.floor(parseFloat(e.target.value) || 0)))}
                                    className="w-16 text-sm text-right"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={() => updateDOLineItem(index, 'Qty', Math.floor((item.Qty ?? 0) + 1))}
                                  >
                                    +
                                  </Button>
                                </div>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.UnitPrice}
                                  onChange={(e) => updateDOLineItem(index, 'UnitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-32 text-sm text-right"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.Discount}
                                  onChange={(e) => updateDOLineItem(index, 'Discount', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-sm text-right"
                                />
                              </td>
                              <td className="p-2 text-right text-sm">
                                {new Intl.NumberFormat('en-MY', {
                                  style: 'currency',
                                  currency: doFormData.CurrencyCode || 'MYR',
                                }).format(item.Amount)}
                              </td>
                              <td className="p-2">
                                <Select
                                  value={item.TaxCode || ''}
                                  onChange={(e) => updateDOLineItem(index, 'TaxCode', e.target.value)}
                                  className="w-32 text-sm h-9"
                                >
                                  <option value="">No Tax</option>
                                  {taxCodes
                                    .filter(tc => tc.IsActive === 'Y' || tc.IsActive === 'T')
                                    .map((taxCode) => {
                                      const taxRate = taxCode.TaxRate ?? 0
                                      const taxRateDisplay = typeof taxRate === 'number' ? taxRate.toFixed(2) : (taxRate || '0.00')
                                      return (
                                        <option key={taxCode.TaxCode} value={taxCode.TaxCode}>
                                          {taxCode.TaxCode} ({taxRateDisplay}%)
                                        </option>
                                      )
                                    })}
                                </Select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No line items. Click "Add Line Item" to add items.
                    </p>
                  )}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingDocKey(null)
                      setDebtorTypeFilter('')
                      setRegisterNoSearch('')
                      setFilteredCustomers([])
                      setDoLineItems([])
                      setCustomerSelected(false)
                      setDoFormData({
                        DocNo: '',
                        DocDate: new Date().toISOString().split('T')[0],
                        DebtorCode: '',
                        Ref: '',
                        Description: '',
                        SalesAgent: '',
                        CurrencyCode: '',
                        CurrencyRate: 1,
                        PostToStock: 'N',
                        TaxEntityName: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !customerSelected}>
                    {saving ? (editingDocKey ? 'Updating...' : 'Creating...') : (editingDocKey ? 'Update Delivery Order' : 'Create Delivery Order')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Product</CardTitle>
                <Button variant="ghost" onClick={() => setShowProductModal(false)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              <div className="mb-4">
                <Input
                  placeholder="Search products..."
                  value={modalProductSearch}
                  onChange={(e) => {
                    setModalProductSearch(e.target.value)
                    fetchModalProducts(e.target.value)
                  }}
                  className="w-full"
                />
              </div>
              <div className="flex-1 overflow-y-auto border rounded-md">
                {loadingProducts ? (
                  <div className="p-4 text-center text-gray-500">Loading products...</div>
                ) : modalProducts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No products found</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold text-sm">Item Code</th>
                        <th className="text-left p-2 font-semibold text-sm">Description</th>
                        <th className="text-left p-2 font-semibold text-sm">UOM</th>
                        <th className="text-right p-2 font-semibold text-sm">Price</th>
                        <th className="text-center p-2 font-semibold text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalProducts.map((product) => (
                        <tr key={product.ItemCode} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm font-medium">{product.ItemCode}</td>
                          <td className="p-2 text-sm">{product.Description || '-'}</td>
                          <td className="p-2 text-sm">{product.SalesUOM || product.UOM || '-'}</td>
                          <td className="p-2 text-sm text-right">
                            {product.Price ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'MYR',
                            }).format(product.Price) : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleModalProductSelect(product)}
                            >
                              Select
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast notifications */}
      {toast.toasts.map((toastItem, index) => (
        <ToastItem
          key={toastItem.id}
          toast={toastItem}
          index={index}
          onClose={() => toast.removeToast(toastItem.id)}
        />
      ))}
    </>
  )
}

// Toast Item Component with auto-dismiss
function ToastItem({ toast, index, onClose }: { toast: { id: string; message: string; type: 'success' | 'error' | 'info' }, index: number, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-4 right-4 z-[100]" style={{ top: `${4 + index * 80}px` }}>
      <div className={`
        rounded-lg px-4 py-3 text-white shadow-lg flex items-center space-x-2 min-w-[300px] transition-all duration-300
        ${toast.type === 'success' ? 'bg-green-500' : 
          toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
      `}>
        <span className="text-lg">
          {toast.type === 'success' ? '✓' : 
           toast.type === 'error' ? '✕' : 'ℹ'}
        </span>
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200 font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
