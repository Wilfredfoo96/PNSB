'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { formatISODateToDDMMYYYY, parseDDMMYYYYToISO } from '@/lib/utils'

interface Invoice {
  DocKey: number
  DocNo: string
  DocDate: string
  DueDate: string
  DebtorCode: string
  DebtorName: string | null
  Total: number | null
  LocalTotal: number | null
  Tax: number | null
  NetTotal: number | null
  PaymentAmt: number | null
  LocalPaymentAmt: number | null
  Outstanding: number | null
  Cancelled: string
  DocStatus: string
  CurrencyCode: string
  LastModified: string
}

interface InvoiceDetail {
  DocKey: number
  DocNo: string
  DocDate: string
  DueDate: string
  DebtorCode: string
  Description: string | null
  SalesAgent: string | null
  CurrencyCode: string
  CurrencyRate: number
  Total: number | null
  LocalTotal: number | null
  Tax: number | null
  NetTotal: number | null
  PaymentAmt: number | null
  Outstanding: number | null
  Cancelled: string
  DocStatus: string
  lineItems: InvoiceLineItem[]
  customer: any
  currency: any
}

interface InvoiceLineItem {
  DtlKey: number
  DocKey: number
  Seq: number
  AccNo: string | null
  Description: string | null
  TaxCode: string | null
  Tax: number | null
  Amount: number | null
  NetAmount: number | null
  SubTotal: number | null
  TaxRate: number | null
}

export default function InvoicesPage() {
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [invoiceFormData, setInvoiceFormData] = useState({
    DocNo: '',
    DocDate: new Date().toISOString().split('T')[0],
    DueDate: new Date().toISOString().split('T')[0],
    DebtorCode: '',
    JournalType: 'AR',
    DisplayTerm: '',
    Description: '',
    SalesAgent: '',
    CurrencyCode: '',
    CurrencyRate: 1,
  })
  type InvoiceLineItemForm = {
    Seq: number
    AccNo: string
    Description: string
    TaxCode: string
    Amount: number
    Tax: number
    SubTotal: number
  }
  const [lineItems, setLineItems] = useState<InvoiceLineItemForm[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState<{ [key: number]: string }>({})
  const [productSearchResults, setProductSearchResults] = useState<{ [key: number]: any[] }>({})
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalProducts, setModalProducts] = useState<any[]>([])
  const [modalProductSearch, setModalProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

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
    // Fetch full product details to get price and other fields
    try {
      const response = await fetch(`/api/autocount/products/${encodeURIComponent(product.ItemCode)}`)
      if (response.ok) {
        const data = await response.json()
        const fullProduct = data.data
        const updated = [...lineItems]
        updated[lineIndex] = {
          ...updated[lineIndex],
          AccNo: fullProduct.ItemCode || product.ItemCode,
          Description: fullProduct.Description || product.Description || '',
          TaxCode: fullProduct.TaxCode || product.TaxCode || '',
          Amount: fullProduct.Price || product.Price || 0,
        }
        // Calculate subtotal
        updated[lineIndex].SubTotal = (updated[lineIndex].Amount || 0) + (updated[lineIndex].Tax || 0)
        
        setLineItems(updated)
        setProductSearchTerm(prev => ({ ...prev, [lineIndex]: fullProduct.ItemCode || product.ItemCode }))
        setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
      } else {
        // Fallback to basic product info if detailed fetch fails
        const updated = [...lineItems]
        updated[lineIndex] = {
          ...updated[lineIndex],
          AccNo: product.ItemCode,
          Description: product.Description || '',
          TaxCode: product.TaxCode || '',
          Amount: product.Price || 0,
        }
        updated[lineIndex].SubTotal = (updated[lineIndex].Amount || 0) + (updated[lineIndex].Tax || 0)
        setLineItems(updated)
        setProductSearchTerm(prev => ({ ...prev, [lineIndex]: product.ItemCode }))
        setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
      }
    } catch (err) {
      console.error('Failed to fetch product details:', err)
      // Fallback to basic product info
      const updated = [...lineItems]
      updated[lineIndex] = {
        ...updated[lineIndex],
        AccNo: product.ItemCode,
        Description: product.Description || '',
        Amount: product.Price || 0,
      }
      updated[lineIndex].SubTotal = (updated[lineIndex].Amount || 0) + (updated[lineIndex].Tax || 0)
      setLineItems(updated)
      setProductSearchTerm(prev => ({ ...prev, [lineIndex]: product.ItemCode }))
      setProductSearchResults(prev => ({ ...prev, [lineIndex]: [] }))
    }
  }

  // Fetch invoices
  const fetchInvoices = async (pageNum: number = 1, searchTerm: string = '', statusFilter: string = '') => {
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

      const response = await fetch(`/api/autocount/invoices-v2?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch invoices')
      }

      const data = await response.json()
      setInvoices(data.data || [])
      setTotal(data.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
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
        setCustomers(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }

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

  // Fetch next invoice number
  const fetchNextInvoiceNumber = async () => {
    try {
      const response = await fetch('/api/autocount/invoices-v2/next-number')
      if (response.ok) {
        const data = await response.json()
        if (data.data?.nextNumber) {
          setInvoiceFormData(prev => ({
            ...prev,
            DocNo: data.data.nextNumber,
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch next invoice number:', err)
      // Fallback: generate a simple number
      const year = new Date().getFullYear()
      const month = String(new Date().getMonth() + 1).padStart(2, '0')
      const nextNumber = `I-${year}${month}-000001`
      setInvoiceFormData(prev => ({
        ...prev,
        DocNo: nextNumber,
      }))
    }
  }

  // Sync status filter from URL (e.g. ?status=Unpaid) and refetch when present
  useEffect(() => {
    const urlStatus = searchParams.get('status')
    if (urlStatus) {
      const normalized = urlStatus.toLowerCase()
      setStatus(normalized)
      fetchInvoices(1, search, normalized)
    }
  }, [searchParams])

  // Initial load (when no status in URL)
  useEffect(() => {
    if (!searchParams.get('status')) {
      fetchInvoices(1, search, status)
    }
    fetchCustomersList()
    fetchCurrenciesList()
  }, [])

  // Auto-fill invoice number when create modal opens
  useEffect(() => {
    if (showCreateModal && !invoiceFormData.DocNo) {
      fetchNextInvoiceNumber()
    }
  }, [showCreateModal])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchInvoices(1, search, status)
  }

  // Handle status filter change
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    fetchInvoices(1, search, newStatus)
  }

  // Handle view invoice
  const handleViewInvoice = async (docKey: number) => {
    try {
      // Use invoices-v2 route (posting-safe IIS API)
      const response = await fetch(`/api/autocount/invoices-v2/${docKey}`)
      if (!response.ok) {
        throw new Error('Failed to fetch invoice details')
      }
      const data = await response.json()
      
      // Transform API response to match existing format
      const invoice = data.data
      if (invoice) {
        setInvoiceDetail({
          ...invoice,
          DocKey: invoice.docKey,
          DocNo: invoice.docNo,
          DocDate: invoice.docDate,
          DueDate: invoice.docDate, // Use DocDate as fallback
          DebtorCode: invoice.debtorCode,
          Description: invoice.description || null,
          SalesAgent: null, // Not available in API response
          CurrencyCode: 'MYR', // Default
          CurrencyRate: 1,
          Total: invoice.total,
          LocalTotal: invoice.total,
          Tax: invoice.tax,
          NetTotal: invoice.total,
          PaymentAmt: 0,
          Outstanding: invoice.total,
          Cancelled: invoice.status === 'Void' ? 'T' : 'F',
          DocStatus: invoice.status === 'Draft' ? 'D' : invoice.status === 'Posted' ? 'P' : 'A',
          lineItems: invoice.lines?.map((line: any, index: number) => ({
            DtlKey: line.dtlKey || index + 1,
            DocKey: invoice.docKey,
            Seq: index + 1,
            AccNo: line.itemCode,
            Description: line.description,
            TaxCode: line.taxCode || null,
            Tax: line.taxAmount || 0,
            Amount: line.lineTotal || (line.quantity * line.unitPrice),
            NetAmount: line.lineTotal || (line.quantity * line.unitPrice),
            SubTotal: line.lineTotal || (line.quantity * line.unitPrice),
            TaxRate: null,
          })) || [],
          customer: null,
          currency: null,
        })
      } else {
        setInvoiceDetail(data.data)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load invoice details')
    }
  }

  // Handle edit invoice
  const handleEditInvoice = async (docKey: number) => {
    await handleViewInvoice(docKey)
    setShowEditModal(true)
  }

  // Handle create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Invoice Create] Form submitted', { invoiceFormData, lineItems })
    setSaving(true)
    setError(null)

    try {
      // DocNo is auto-generated, so it's not required for validation
      if (!invoiceFormData.DocDate || !invoiceFormData.DebtorCode || 
          !invoiceFormData.JournalType || !invoiceFormData.DisplayTerm || !invoiceFormData.DueDate ||
          !invoiceFormData.CurrencyCode || !invoiceFormData.CurrencyRate) {
        console.warn('[Invoice Create] Validation failed - missing required fields', invoiceFormData)
        setError('All required fields must be filled')
        setSaving(false)
        return
      }

      const requestBody = {
        header: {
          DocNo: invoiceFormData.DocNo,
          DocDate: invoiceFormData.DocDate,
          DebtorCode: invoiceFormData.DebtorCode,
          JournalType: invoiceFormData.JournalType,
          DisplayTerm: invoiceFormData.DisplayTerm,
          DueDate: invoiceFormData.DueDate,
          Description: invoiceFormData.Description,
          SalesAgent: invoiceFormData.SalesAgent,
          CurrencyCode: invoiceFormData.CurrencyCode,
          CurrencyRate: invoiceFormData.CurrencyRate,
        },
        lineItems: lineItems.map((item, index) => ({
          Seq: index + 1,
          AccNo: item.AccNo,
          Description: item.Description,
          TaxCode: item.TaxCode,
          Tax: item.Tax || 0,
          Amount: item.Amount || 0,
          NetAmount: item.Amount || 0,
          SubTotal: item.SubTotal || item.Amount || 0,
        })),
      }
      console.log('[Invoice Create] Sending request to API', requestBody)

      // Use invoices-v2 route (posting-safe IIS API)
      const response = await fetch('/api/autocount/invoices-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[Invoice Create] API response status', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Invoice Create] API error', errorData)
        throw new Error(errorData.error || 'Failed to create invoice')
      }

      const responseData = await response.json()
      console.log('[Invoice Create] Success', responseData)

      setShowCreateModal(false)
      console.log('[Invoice Create] Resetting form data')
      setInvoiceFormData({
        DocNo: '',
        DocDate: new Date().toISOString().split('T')[0],
        DueDate: new Date().toISOString().split('T')[0],
        DebtorCode: '',
        JournalType: 'AR',
        DisplayTerm: '',
        Description: '',
        SalesAgent: '',
        CurrencyCode: '',
        CurrencyRate: 1,
      })
      setLineItems([])
      await fetchInvoices(page, search, status)
      alert('Invoice created successfully')
    } catch (err) {
      console.error('[Invoice Create] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSaving(false)
      console.log('[Invoice Create] Form submission completed')
    }
  }

  // Handle update invoice
  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Invoice Update] Form submitted', { invoiceDetail })
    if (!invoiceDetail) {
      console.warn('[Invoice Update] No invoice detail available')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const requestBody = {
        header: {
          description: invoiceDetail.Description,
          salesAgent: invoiceDetail.SalesAgent,
          dueDate: invoiceDetail.DueDate,
          currencyCode: invoiceDetail.CurrencyCode,
          currencyRate: invoiceDetail.CurrencyRate,
        },
        lineItems: invoiceDetail.lineItems.map((item) => ({
          Seq: item.Seq,
          AccNo: item.AccNo,
          Description: item.Description,
          TaxCode: item.TaxCode,
          Tax: item.Tax,
          Amount: item.Amount,
          NetAmount: item.NetAmount,
          SubTotal: item.SubTotal,
        })),
      }
      console.log('[Invoice Update] Sending request to API', { docKey: invoiceDetail.DocKey, requestBody })

      // Use invoices-v2 PUT endpoint (posting-safe)
      const response = await fetch(`/api/autocount/invoices-v2/${invoiceDetail.DocKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[Invoice Update] API response status', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Invoice Update] API error', errorData)
        throw new Error(errorData.error || 'Failed to update invoice')
      }

      const responseData = await response.json()
      console.log('[Invoice Update] Success', responseData)

      setShowEditModal(false)
      await fetchInvoices(page, search, status)
      alert('Invoice updated successfully')
    } catch (err) {
      console.error('[Invoice Update] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to update invoice')
    } finally {
      setSaving(false)
      console.log('[Invoice Update] Form submission completed')
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
  const addLineItem = () => {
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

      const newItem = {
        Seq: lineItems.length + 1,
        AccNo: fullProduct.ItemCode || product.ItemCode,
        Description: fullProduct.Description || product.Description || '',
        TaxCode: fullProduct.TaxCode || product.TaxCode || '',
        Amount: fullProduct.Price || product.Price || 0,
        Tax: 0,
        SubTotal: (fullProduct.Price || product.Price || 0) + 0,
      }
      
      setLineItems([...lineItems, newItem])
      setShowProductModal(false)
      setModalProductSearch('')
    } catch (err) {
      console.error('Failed to fetch product details:', err)
      // Fallback to basic product info
      const newItem = {
        Seq: lineItems.length + 1,
        AccNo: product.ItemCode,
        Description: product.Description || '',
        TaxCode: product.TaxCode || '',
        Amount: product.Price || 0,
        Tax: 0,
        SubTotal: product.Price || 0,
      }
      setLineItems([...lineItems, newItem])
      setShowProductModal(false)
      setModalProductSearch('')
    }
  }

  // Remove line item
  const removeLineItem = (index: number) => {
    console.log('[Invoice Create] Removing line item', { index, item: lineItems[index] })
    setLineItems(lineItems.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      Seq: i + 1,
    })))
  }

  // Update line item
  const updateLineItem = (index: number, field: keyof InvoiceLineItemForm, value: any) => {
    console.log('[Invoice Create] Updating line item', { index, field, value, oldValue: lineItems[index]?.[field] })
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    // Calculate subtotal
    if (field === 'Amount' || field === 'Tax') {
      updated[index].SubTotal = (updated[index].Amount || 0) + (updated[index].Tax || 0)
      console.log('[Invoice Create] Recalculated subtotal', { 
        index, 
        amount: updated[index].Amount, 
        tax: updated[index].Tax, 
        subtotal: updated[index].SubTotal 
      })
    }
    setLineItems(updated)
  }

  // Handle delete invoice
  const handleDeleteInvoice = async (docKey: number, docNo: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${docNo}?`)) {
      return
    }

    try {
      // Use invoices-v2 DELETE endpoint (voids the invoice)
      const response = await fetch(`/api/autocount/invoices-v2/${docKey}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete invoice')
      }

      await fetchInvoices(page, search, status)
      alert('Invoice cancelled successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invoice')
    }
  }

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.Cancelled === 'Y') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50">
          Cancelled
        </span>
      )
    }
    if (invoice.Outstanding && Number(invoice.Outstanding) <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
          Paid
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
        Unpaid
      </span>
    )
  }

  const isUnpaidFilter = status?.toLowerCase() === 'unpaid'

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Manage your sales invoices and track payments."
        {...(!isUnpaidFilter && {
          actionLabel: 'Create Invoice',
          actionIcon: 'add',
          onAction: () => {
            setInvoiceFormData({
              DocNo: '',
              DocDate: new Date().toISOString().split('T')[0],
              DueDate: new Date().toISOString().split('T')[0],
              DebtorCode: '',
              JournalType: 'AR',
              DisplayTerm: '',
              Description: '',
              SalesAgent: '',
              CurrencyCode: '',
              CurrencyRate: 1,
            });
            setLineItems([]);
            setShowCreateModal(true);
          },
        })}
      />
      <div className="px-8 pb-8 flex-1">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
      {/* Search and Filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <form onSubmit={handleSearch} className="w-full">
                <input
                  type="text"
                  placeholder="Search by invoice number, customer, or total..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-slate-200"
                />
              </form>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                  className="pl-4 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary dark:text-slate-200 min-w-[120px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="cancelled">Cancelled</option>
              </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
            </div>
              <button
                onClick={() => fetchInvoices(page, search, status)}
                className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh Table"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
          </div>
          </div>

          {error && (
            <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {search || status ? 'No invoices found matching your filters' : 'No invoices found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoice No</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paid</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outstanding</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {invoices.map((invoice) => (
                      <tr key={invoice.DocKey} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-semibold text-sm text-primary">{invoice.DocNo}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{new Date(invoice.DocDate).toLocaleDateString('en-GB')}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{invoice.DebtorName || invoice.DebtorCode}</td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {invoice.Total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoice.CurrencyCode || 'MYR',
                              }).format(Number(invoice.Total))
                            : '-'}
                        </td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {invoice.PaymentAmt
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoice.CurrencyCode || 'MYR',
                              }).format(Number(invoice.PaymentAmt))
                            : '-'}
                        </td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {invoice.Outstanding
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoice.CurrencyCode || 'MYR',
                              }).format(Number(invoice.Outstanding))
                            : '-'}
                        </td>
                        <td className="px-6 py-3">{getStatusBadge(invoice)}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="row-actions flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleViewInvoice(invoice.DocKey)}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                              title="View Detail"
                            >
                              <span className="material-symbols-outlined text-xl">visibility</span>
                            </button>
                            {invoice.Cancelled !== 'Y' && !isUnpaidFilter && (
                              <>
                                <button
                                  onClick={() => handleEditInvoice(invoice.DocKey)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                  title="Edit Invoice"
                                >
                                  <span className="material-symbols-outlined text-xl">edit_note</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteInvoice(invoice.DocKey, invoice.DocNo)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                  title="Delete"
                                >
                                  <span className="material-symbols-outlined text-xl">delete</span>
                                </button>
                              </>
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
                    onClick={() => fetchInvoices(page - 1, search, status)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-not-allowed border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-white bg-[#1e40af] rounded-lg border border-[#1e40af] shadow-sm">
                    {page}
                  </button>
                  <button
                    onClick={() => fetchInvoices(page + 1, search, status)}
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

      {/* View Invoice Modal */}
      {invoiceDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice Details: {invoiceDetail.DocNo}</CardTitle>
                <div className="flex gap-2">
                  {invoiceDetail.Cancelled !== 'Y' && !isUnpaidFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEditModal(true)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setInvoiceDetail(null)}>
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
                    <Label className="text-sm font-semibold">Invoice Number</Label>
                    <p className="text-sm">{invoiceDetail.DocNo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Date</Label>
                    <p className="text-sm">{new Date(invoiceDetail.DocDate).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Due Date</Label>
                    <p className="text-sm">{new Date(invoiceDetail.DueDate).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Customer</Label>
                    <p className="text-sm">
                      {invoiceDetail.customer?.CompanyName || invoiceDetail.DebtorCode}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Currency</Label>
                    <p className="text-sm">{invoiceDetail.CurrencyCode} (Rate: {invoiceDetail.CurrencyRate})</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Status</Label>
                    <p className="text-sm">
                      {invoiceDetail.Cancelled === 'Y' ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          Cancelled
                        </span>
                      ) : invoiceDetail.Outstanding && Number(invoiceDetail.Outstanding) <= 0 ? (
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
                        {invoiceDetail.lineItems && invoiceDetail.lineItems.length > 0 ? (
                          invoiceDetail.lineItems.map((item) => (
                            <tr key={item.DtlKey} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm">{item.Seq}</td>
                              <td className="p-2 text-sm">{item.AccNo || '-'}</td>
                              <td className="p-2 text-sm">{item.Description || '-'}</td>
                              <td className="p-2 text-sm text-right">{item.TaxCode || '-'}</td>
                              <td className="p-2 text-sm text-right">
                                {item.Amount
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: invoiceDetail.CurrencyCode || 'MYR',
                                    }).format(Number(item.Amount))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {item.Tax
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: invoiceDetail.CurrencyCode || 'MYR',
                                    }).format(Number(item.Tax))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {item.SubTotal
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: invoiceDetail.CurrencyCode || 'MYR',
                                    }).format(Number(item.SubTotal))
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
                          {invoiceDetail.NetTotal
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoiceDetail.CurrencyCode || 'MYR',
                              }).format(Number(invoiceDetail.NetTotal))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Tax:</Label>
                        <p className="text-sm">
                          {invoiceDetail.Tax
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoiceDetail.CurrencyCode || 'MYR',
                              }).format(Number(invoiceDetail.Tax))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-sm font-bold">Total:</Label>
                        <p className="text-sm font-bold">
                          {invoiceDetail.Total
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoiceDetail.CurrencyCode || 'MYR',
                              }).format(Number(invoiceDetail.Total))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Label className="text-sm font-semibold">Paid:</Label>
                        <p className="text-sm">
                          {invoiceDetail.PaymentAmt
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoiceDetail.CurrencyCode || 'MYR',
                              }).format(Number(invoiceDetail.PaymentAmt))
                            : '-'}
                        </p>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-sm font-bold">Outstanding:</Label>
                        <p className="text-sm font-bold">
                          {invoiceDetail.Outstanding
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: invoiceDetail.CurrencyCode || 'MYR',
                              }).format(Number(invoiceDetail.Outstanding))
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

      {/* Edit Invoice Modal */}
      {showEditModal && invoiceDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Invoice: {invoiceDetail.DocNo}</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowEditModal(false)
                }}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={invoiceDetail.Description || ''}
                      onChange={(e) => setInvoiceDetail({
                        ...invoiceDetail,
                        Description: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label>Sales Agent</Label>
                    <Input
                      value={invoiceDetail.SalesAgent || ''}
                      onChange={(e) => setInvoiceDetail({
                        ...invoiceDetail,
                        SalesAgent: e.target.value
                      })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Due Date (DD/MM/YYYY)</Label>
                  <Input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={invoiceDetail.DueDate ? formatISODateToDDMMYYYY(invoiceDetail.DueDate) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      if (raw === '') {
                        setInvoiceDetail({ ...invoiceDetail, DueDate: new Date().toISOString().split('T')[0] })
                        return
                      }
                      const iso = parseDDMMYYYYToISO(e.target.value)
                      if (iso !== null) setInvoiceDetail({ ...invoiceDetail, DueDate: iso })
                    }}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Updating...' : 'Update Invoice'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Invoice</CardTitle>
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateInvoice} className="space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <Label htmlFor="DocNo">Invoice Number (Auto-generated)</Label>
                    <Input
                      id="DocNo"
                      value={invoiceFormData.DocNo}
                      onChange={(e) => {
                        console.log('[Invoice Create] DocNo changed', { old: invoiceFormData.DocNo, new: e.target.value })
                        setInvoiceFormData({ ...invoiceFormData, DocNo: e.target.value })
                      }}
                      placeholder="Auto-generated..."
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <Label htmlFor="DebtorCode">Customer *</Label>
                    <select
                      id="DebtorCode"
                      value={invoiceFormData.DebtorCode}
                      onChange={(e) => {
                        console.log('[Invoice Create] DebtorCode changed', { old: invoiceFormData.DebtorCode, new: e.target.value })
                        setInvoiceFormData({ ...invoiceFormData, DebtorCode: e.target.value })
                      }}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.AccNo} value={customer.AccNo}>
                          {customer.AccNo} - {customer.CompanyName || customer.AccNo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="DocDate">Invoice Date * (DD/MM/YYYY)</Label>
                    <Input
                      id="DocDate"
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatISODateToDDMMYYYY(invoiceFormData.DocDate)}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') {
                          setInvoiceFormData({ ...invoiceFormData, DocDate: new Date().toISOString().split('T')[0] })
                          return
                        }
                        const iso = parseDDMMYYYYToISO(e.target.value)
                        if (iso !== null) setInvoiceFormData({ ...invoiceFormData, DocDate: iso })
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="DueDate">Due Date * (DD/MM/YYYY)</Label>
                    <Input
                      id="DueDate"
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatISODateToDDMMYYYY(invoiceFormData.DueDate)}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') {
                          setInvoiceFormData({ ...invoiceFormData, DueDate: new Date().toISOString().split('T')[0] })
                          return
                        }
                        const iso = parseDDMMYYYYToISO(e.target.value)
                        if (iso !== null) setInvoiceFormData({ ...invoiceFormData, DueDate: iso })
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="CurrencyCode">Currency *</Label>
                    <select
                      id="CurrencyCode"
                      value={invoiceFormData.CurrencyCode}
                      onChange={(e) => {
                        const selected = currencies.find(c => c.CurrencyCode === e.target.value)
                        console.log('[Invoice Create] Currency changed', { 
                          old: invoiceFormData.CurrencyCode, 
                          new: e.target.value, 
                          selected, 
                          rate: selected?.CurrencyRate || 1 
                        })
                        setInvoiceFormData({
                          ...invoiceFormData,
                          CurrencyCode: e.target.value,
                          CurrencyRate: selected?.CurrencyRate || 1,
                        })
                      }}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select Currency</option>
                      {currencies.map((currency) => (
                        <option key={currency.CurrencyCode} value={currency.CurrencyCode}>
                          {currency.CurrencyCode} - {currency.CurrencyName || currency.CurrencyCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="CurrencyRate">Currency Rate *</Label>
                    <Input
                      id="CurrencyRate"
                      type="number"
                      step="0.0001"
                      value={invoiceFormData.CurrencyRate}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, CurrencyRate: parseFloat(e.target.value) || 1 })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="DisplayTerm">Payment Term *</Label>
                    <Input
                      id="DisplayTerm"
                      value={invoiceFormData.DisplayTerm}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, DisplayTerm: e.target.value })}
                      required
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <Label htmlFor="SalesAgent">Sales Agent</Label>
                    <Input
                      id="SalesAgent"
                      value={invoiceFormData.SalesAgent}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, SalesAgent: e.target.value })}
                      maxLength={12}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="Description">Description</Label>
                    <Input
                      id="Description"
                      value={invoiceFormData.Description}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, Description: e.target.value })}
                      maxLength={80}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-lg font-semibold">Line Items</Label>
                    <Button type="button" onClick={addLineItem} variant="outline" size="sm">
                      + Add Line Item
                    </Button>
                  </div>
                  {lineItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold text-sm">Seq</th>
                            <th className="text-left p-2 font-semibold text-sm">Account</th>
                            <th className="text-left p-2 font-semibold text-sm">Description</th>
                            <th className="text-left p-2 font-semibold text-sm">Tax Code</th>
                            <th className="text-right p-2 font-semibold text-sm">Amount</th>
                            <th className="text-right p-2 font-semibold text-sm">Tax</th>
                            <th className="text-right p-2 font-semibold text-sm">Subtotal</th>
                            <th className="text-center p-2 font-semibold text-sm">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-2">{item.Seq}</td>
                              <td className="p-2 relative">
                                <Input
                                  value={item.AccNo}
                                  onChange={(e) => {
                                    updateLineItem(index, 'AccNo', e.target.value)
                                    setProductSearchTerm(prev => ({ ...prev, [index]: e.target.value }))
                                    searchProducts(e.target.value, index)
                                  }}
                                  onBlur={() => {
                                    // Clear search results after a delay to allow click
                                    setTimeout(() => {
                                      setProductSearchResults(prev => ({ ...prev, [index]: [] }))
                                    }, 200)
                                  }}
                                  className="w-24 text-sm"
                                  maxLength={12}
                                  placeholder="Search..."
                                />
                                {productSearchResults[index] && productSearchResults[index].length > 0 && (
                                  <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {productSearchResults[index].map((product) => (
                                      <div
                                        key={product.ItemCode}
                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b"
                                        onClick={() => handleProductSelect(index, product)}
                                      >
                                        <div className="font-semibold text-sm">{product.ItemCode}</div>
                                        <div className="text-xs text-gray-600">{product.Description}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                <Input
                                  value={item.Description}
                                  onChange={(e) => updateLineItem(index, 'Description', e.target.value)}
                                  className="w-full text-sm"
                                  maxLength={80}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={item.TaxCode}
                                  onChange={(e) => updateLineItem(index, 'TaxCode', e.target.value)}
                                  className="w-24 text-sm"
                                  maxLength={14}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.Amount}
                                  onChange={(e) => updateLineItem(index, 'Amount', parseFloat(e.target.value) || 0)}
                                  className="w-32 text-sm text-right"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.Tax}
                                  onChange={(e) => updateLineItem(index, 'Tax', parseFloat(e.target.value) || 0)}
                                  className="w-32 text-sm text-right"
                                />
                              </td>
                              <td className="p-2 text-right text-sm">
                                {new Intl.NumberFormat('en-MY', {
                                  style: 'currency',
                                  currency: invoiceFormData.CurrencyCode || 'MYR',
                                }).format(item.SubTotal)}
                              </td>
                              <td className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLineItem(index)}
                                >
                                  ×
                                </Button>
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

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false)
                      setLineItems([])
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Invoice'}
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
                        <th className="text-right p-2 font-semibold text-sm">Price</th>
                        <th className="text-center p-2 font-semibold text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalProducts.map((product) => (
                        <tr key={product.ItemCode} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm font-medium">{product.ItemCode}</td>
                          <td className="p-2 text-sm">{product.Description || '-'}</td>
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
    </>
  )
}
