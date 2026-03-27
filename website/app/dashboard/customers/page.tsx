'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/dashboard/PageHeader'

interface Customer {
  AutoKey: number
  AccNo: string
  CompanyName: string | null
  Desc2: string | null
  Attention: string | null
  Address1: string | null
  Address2: string | null
  Address3: string | null
  Address4: string | null
  PostCode: string | null
  Phone1: string | null
  Phone2: string | null
  Mobile: string | null
  EmailAddress: string | null
  CreditLimit: number | null
  DisplayTerm: string
  CurrencyCode: string
  TaxCode: string | null
  SalesAgent: string | null
  IsActive: string
  LastModified: string | null
  LastModifiedUserID: string | null
  RegisterNo: string | null
  TinNo: string | null
  DebtorType: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    AccNo: '',
    CompanyName: '',
    Attention: '',
    Address1: '',
    Address2: '',
    Address3: '',
    Address4: '',
    EmailAddress: '',
    CreditLimit: '',
    DebtorType: '',
    IsActive: 'Y',
  })

  // Fetch customers
  const fetchCustomers = async (pageNum: number = 1, searchTerm: string = '') => {
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

      const response = await fetch(`/api/autocount/customers?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch customers')
      }

      const data = await response.json()
      setCustomers(data.data || [])
      setTotal(data.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchCustomers(1, search)
  }, [])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCustomers(1, search)
  }

  // Handle view customer - fetch full details
  const handleViewCustomer = async (accNo: string) => {
    try {
      const response = await fetch(`/api/autocount/customers/${encodeURIComponent(accNo)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch customer details')
      }
      const data = await response.json()
      setSelectedCustomer(data.data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load customer details')
    }
  }

  // Handle create customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Customer Create] Form submitted', { formData })
    setSaving(true)
    setError(null)

    try {
      // Validate required fields
      if (!formData.AccNo) {
        console.warn('[Customer Create] Validation failed - missing required fields', formData)
        setError('AccNo is required')
        setSaving(false)
        return
      }

      const requestBody = {
        AccNo: formData.AccNo,
        CompanyName: formData.CompanyName || null,
        Attention: formData.Attention || null,
        Address1: formData.Address1 || null,
        Address2: formData.Address2 || null,
        Address3: formData.Address3 || null,
        Address4: formData.Address4 || null,
        EmailAddress: formData.EmailAddress || null,
        CreditLimit: formData.CreditLimit ? parseFloat(formData.CreditLimit) : null,
        DisplayTerm: 'C.O.D.', // Default payment terms
        CurrencyCode: 'MYR', // Hardcoded to MYR
        DebtorType: formData.DebtorType || null,
        IsActive: formData.IsActive,
      }
      console.log('[Customer Create] Sending request to API', requestBody)

      const response = await fetch('/api/autocount/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[Customer Create] API response status', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Customer Create] API error', errorData)
        throw new Error(errorData.error || 'Failed to create customer')
      }

      const responseData = await response.json()
      console.log('[Customer Create] Success', responseData)

      // Reset form and close modal
      console.log('[Customer Create] Resetting form data')
      setFormData({
        AccNo: '',
        CompanyName: '',
        Attention: '',
        Address1: '',
        Address2: '',
        Address3: '',
        Address4: '',
        EmailAddress: '',
        CreditLimit: '',
        DebtorType: '',
        IsActive: 'Y',
      })
      setShowAddModal(false)
      
      // Refresh list
      await fetchCustomers(page, search)
      alert('Customer created successfully')
    } catch (err) {
      console.error('[Customer Create] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to create customer')
    } finally {
      setSaving(false)
      console.log('[Customer Create] Form submission completed')
    }
  }

  // Handle delete
  const handleDelete = async (accNo: string) => {
    if (!confirm(`Are you sure you want to delete customer ${accNo}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/autocount/customers/${encodeURIComponent(accNo)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete customer')
      }

      const result = await response.json()
      alert(result.message || 'Customer deleted successfully')
      
      // Refresh list
      await fetchCustomers(page, search)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete customer')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      AccNo: '',
      CompanyName: '',
      Attention: '',
      Address1: '',
      Address2: '',
      Address3: '',
      Address4: '',
      EmailAddress: '',
      CreditLimit: '',
      DebtorType: '',
      IsActive: 'Y',
    })
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage your customer database and relationships."
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
                  placeholder="Search by customer code, name, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-slate-200"
                />
              </form>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCustomers(page, search)}
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
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {search ? 'No customers found matching your search' : 'No customers found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Debtor Code</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient Name</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payee Name</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NRIC/Passport</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NRIC/Passport No</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {customers.map((customer) => (
                      <tr key={customer.AccNo} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-semibold text-sm text-primary">{customer.AccNo}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{customer.CompanyName || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{customer.Attention || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{customer.Mobile || customer.Phone1 || customer.Phone2 || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{customer.DebtorType || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{customer.RegisterNo || '-'}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                customer.IsActive === 'Y' || customer.IsActive === 'T'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50'
                            }`}
                          >
                              {customer.IsActive === 'Y' || customer.IsActive === 'T' ? 'Active' : 'Inactive'}
                          </span>
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
                    onClick={() => fetchCustomers(page - 1, search)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-not-allowed border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-white bg-[#1e40af] rounded-lg border border-[#1e40af] shadow-sm">
                    {page}
                  </button>
                  <button
                    onClick={() => fetchCustomers(page + 1, search)}
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Customer</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="AccNo">Account Number *</Label>
                    <Input
                      id="AccNo"
                      value={formData.AccNo}
                      onChange={(e) => setFormData({ ...formData, AccNo: e.target.value })}
                      required
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <Label htmlFor="CompanyName">Patient Name</Label>
                    <Input
                      id="CompanyName"
                      value={formData.CompanyName}
                      onChange={(e) => setFormData({ ...formData, CompanyName: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="Attention">Payee Name</Label>
                  <Input
                    id="Attention"
                    value={formData.Attention}
                    onChange={(e) => setFormData({ ...formData, Attention: e.target.value })}
                    maxLength={40}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="Address1">Address Line 1</Label>
                    <Input
                      id="Address1"
                      value={formData.Address1}
                      onChange={(e) => setFormData({ ...formData, Address1: e.target.value })}
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <Label htmlFor="Address2">Address Line 2</Label>
                    <Input
                      id="Address2"
                      value={formData.Address2}
                      onChange={(e) => setFormData({ ...formData, Address2: e.target.value })}
                      maxLength={40}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="Address3">Address Line 3</Label>
                    <Input
                      id="Address3"
                      value={formData.Address3}
                      onChange={(e) => setFormData({ ...formData, Address3: e.target.value })}
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <Label htmlFor="Address4">Address Line 4</Label>
                    <Input
                      id="Address4"
                      value={formData.Address4}
                      onChange={(e) => setFormData({ ...formData, Address4: e.target.value })}
                      maxLength={40}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="EmailAddress">Email</Label>
                    <Input
                      id="EmailAddress"
                      type="email"
                      value={formData.EmailAddress}
                      onChange={(e) => setFormData({ ...formData, EmailAddress: e.target.value })}
                      maxLength={200}
                    />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="DebtorType">Debtor Type</Label>
                    <select
                      id="DebtorType"
                      value={formData.DebtorType}
                      onChange={(e) => setFormData({ ...formData, DebtorType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select Type</option>
                      <option value="NRIC">NRIC</option>
                      <option value="PASSPORT">PASSPORT</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="CreditLimit">Credit Limit</Label>
                    <Input
                      id="CreditLimit"
                      type="number"
                      step="0.01"
                      value={formData.CreditLimit}
                      onChange={(e) => setFormData({ ...formData, CreditLimit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="IsActive">Status</Label>
                    <select
                      id="IsActive"
                      value={formData.IsActive}
                      onChange={(e) => setFormData({ ...formData, IsActive: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="Y">Active</option>
                      <option value="N">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Customer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Customer Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Customer Details: {selectedCustomer.AccNo}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>
                    ×
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Account Number</Label>
                    <p className="text-sm">{selectedCustomer.AccNo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Patient Name</Label>
                    <p className="text-sm">{selectedCustomer.CompanyName || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Payee Name</Label>
                    <p className="text-sm">{selectedCustomer.Attention || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Address</Label>
                  <p className="text-sm">
                    {[
                      selectedCustomer.Address1,
                      selectedCustomer.Address2,
                      selectedCustomer.Address3,
                      selectedCustomer.Address4,
                      selectedCustomer.PostCode
                    ].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Phone 1</Label>
                    <p className="text-sm">{selectedCustomer.Phone1 || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Phone 2</Label>
                    <p className="text-sm">{selectedCustomer.Phone2 || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Mobile</Label>
                    <p className="text-sm">{selectedCustomer.Mobile || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm">{selectedCustomer.EmailAddress || '-'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Credit Limit</Label>
                    <p className="text-sm">
                      {selectedCustomer.CreditLimit
                        ? new Intl.NumberFormat('en-MY', {
                            style: 'currency',
                            currency: selectedCustomer.CurrencyCode || 'MYR',
                          }).format(Number(selectedCustomer.CreditLimit))
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Payment Terms</Label>
                    <p className="text-sm">{selectedCustomer.DisplayTerm || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Currency</Label>
                    <p className="text-sm">{selectedCustomer.CurrencyCode || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Status</Label>
                    <p className="text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          selectedCustomer.IsActive === 'Y'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedCustomer.IsActive === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
