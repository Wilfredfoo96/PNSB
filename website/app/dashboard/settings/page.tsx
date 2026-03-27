'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface TaxCode {
  TaxCode: string
  Description: string | null
  TaxRate: number
  IsActive: string
}

interface Classification {
  Code: string
  Description: string | null
}

interface Branch {
  _id: Id<'branches'>
  _creationTime: number
  branchName: string
  alias?: string
  doNumbering?: string
  trNumbering?: string
  createdAt: number
  updatedAt: number
}

export default function SettingsPage() {
  const userRole = useUserRole()
  const permissions = getPermissionsForRole(userRole)
  const [activeTab, setActiveTab] = useState('general')
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Branches state (using Convex)
  const branches = useQuery(api.branches.getBranches) || []
  const createBranchMutation = useMutation(api.branches.createBranch)
  const updateBranchMutation = useMutation(api.branches.updateBranch)
  const deleteBranchMutation = useMutation(api.branches.deleteBranch)
  // Note: getBranchReceiptCount will be called per branch when needed
  const [branchError, setBranchError] = useState<string | null>(null)
  const [branchSaving, setBranchSaving] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [branchModalTab, setBranchModalTab] = useState('general')
  const [branchName, setBranchName] = useState('')
  const [alias, setAlias] = useState('')
  const [doNumbering, setDoNumbering] = useState('SOTP1') // Prefix only
  const [trNumbering, setTrNumbering] = useState('')
  const [branchDoCounts, setBranchDoCounts] = useState<Record<string, number>>({})
  
  // Product Template state
  const [productTemplates, setProductTemplates] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [nricTaxCode, setNricTaxCode] = useState('')
  const [passportTaxCode, setPassportTaxCode] = useState('')
  const [defaultQty] = useState<number>(0) // Always 0 - field removed from UI
  const [defaultPrice, setDefaultPrice] = useState<number>(0)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const getProductTemplates = useQuery(
    api.branchProductTemplates.getByBranch, 
    editingBranch ? { branchId: editingBranch._id } : 'skip'
  )
  const upsertTemplate = useMutation(api.branchProductTemplates.upsert)
  const removeTemplate = useMutation(api.branchProductTemplates.remove)

  // Load product templates when editing branch changes
  useEffect(() => {
    if (editingBranch && getProductTemplates) {
      setProductTemplates(getProductTemplates)
    } else {
      setProductTemplates([])
    }
  }, [editingBranch, getProductTemplates])

  // Load products list and tax codes when product template tab is opened
  useEffect(() => {
    if (showBranchModal && branchModalTab === 'product-template') {
      console.log('[DEBUG] Product template tab opened, current taxCodes.length:', taxCodes.length)
      
      // Always fetch tax codes when tab opens to ensure fresh data
      const loadData = async () => {
        const loadedTaxCodes = await fetchTaxCodes()
        console.log('[DEBUG] Tax codes fetched, count:', loadedTaxCodes.length)
        
        // Load products
        setLoadingProducts(true)
        try {
          const res = await fetch('/api/autocount/products-v2?limit=1000&activeOnly=true')
          const data = await res.json()
          console.log('[DEBUG] Products loaded, count:', data.data?.length || 0)
          if (data.data) {
            setProducts(data.data)
          }
        } catch (err) {
          console.error('[DEBUG] Failed to load products:', err)
        } finally {
          setLoadingProducts(false)
        }
      }
      
      loadData()
    }
  }, [showBranchModal, branchModalTab])

  // Tax Code form state
  const [taxCodeForm, setTaxCodeForm] = useState({
    TaxCode: '',
    Description: '',
    TaxRate: '',
  })

  // Classification form state
  const [classificationForm, setClassificationForm] = useState({
    Code: '',
    Description: '',
  })

  // Fetch Tax Codes
  const fetchTaxCodes = async () => {
    console.log('[DEBUG] fetchTaxCodes called')
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/autocount/settings/tax-codes')
      console.log('[DEBUG] Tax codes API response status:', response.status)
      if (!response.ok) {
        throw new Error('Failed to fetch tax codes')
      }
      const data = await response.json()
      console.log('[DEBUG] Tax codes data received:', JSON.stringify(data, null, 2))
      const codes = data.data || []
      console.log('[DEBUG] Setting tax codes, count:', codes.length)
      setTaxCodes(codes)
      return codes
    } catch (err) {
      console.error('[DEBUG] Error fetching tax codes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tax codes')
      return []
    } finally {
      setLoading(false)
    }
  }

  // Fetch Classifications
  const fetchClassifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/autocount/settings/classifications')
      if (!response.ok) {
        throw new Error('Failed to fetch classifications')
      }
      const data = await response.json()
      setClassifications(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classifications')
    } finally {
      setLoading(false)
    }
  }

  // Fetch DO counts for branches (to check if branch can be edited/deleted)
  const fetchBranchDoCounts = async () => {
    const counts: Record<string, number> = {}
    for (const branch of branches) {
      try {
        // Check DO count by prefix pattern
        // Use search to find DOs with this branch prefix
        if (branch.doNumbering) {
          const prefix = branch.doNumbering
          const response = await fetch(`/api/autocount/delivery-orders-v2?page=1&limit=1&search=${encodeURIComponent(prefix)}`)
          if (response.ok) {
            const data = await response.json()
            // Get total count from pagination
            counts[branch._id] = data.pagination?.total || 0
          } else {
            counts[branch._id] = 0
          }
        } else {
          counts[branch._id] = 0
        }
      } catch (err) {
        console.error(`Error fetching DO count for branch ${branch._id}:`, err)
        counts[branch._id] = 0
      }
    }
    setBranchDoCounts(counts)
  }

  // Fetch DO counts when branches change
  useEffect(() => {
    if (branches.length > 0) {
      fetchBranchDoCounts()
    }
  }, [branches])

  // Initial load
  useEffect(() => {
    fetchTaxCodes()
    fetchClassifications()
  }, [])

  // Handle Tax Code form submit
  const handleTaxCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!taxCodeForm.TaxCode || !taxCodeForm.TaxRate) {
        setError('Tax Code and Tax Rate are required')
        setSaving(false)
        return
      }

      const response = await fetch('/api/autocount/settings/tax-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          TaxCode: taxCodeForm.TaxCode,
          Description: taxCodeForm.Description || null,
          TaxRate: parseFloat(taxCodeForm.TaxRate),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tax code')
      }

      // Reset form and refresh
      setTaxCodeForm({ TaxCode: '', Description: '', TaxRate: '' })
      await fetchTaxCodes()
      alert('Tax Code created successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tax code')
    } finally {
      setSaving(false)
    }
  }

  // Handle Classification form submit
  const handleClassificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!classificationForm.Code) {
        setError('Code is required')
        setSaving(false)
        return
      }

      const response = await fetch('/api/autocount/settings/classifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Code: classificationForm.Code,
          Description: classificationForm.Description || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create classification')
      }

      // Reset form and refresh
      setClassificationForm({ Code: '', Description: '' })
      await fetchClassifications()
      alert('Classification created successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create classification')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage system settings and configurations."
      />
      <div className="px-8 pb-8 flex-1">
    <div className="space-y-6">

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="tax-codes">Tax Code Retrieving Page (TCRP)</TabsTrigger>
          <TabsTrigger value="classifications">E-invoice Classification Setting Page (EICSP)</TabsTrigger>
        </TabsList>

        {/* General Tab - Empty */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>General system settings and configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                No settings available yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Branches</CardTitle>
                  <CardDescription>Manage company branches</CardDescription>
                </div>
                {permissions.canCreateBranch && (
                  <Button onClick={() => { 
                    setBranchName('')
                    setAlias('')
                    setDoNumbering('SOTP1')
                    setTrNumbering('')
                    setEditingBranch(null)
                    setShowBranchForm(true)
                  }}>
                    Add New Branch
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {branchError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {branchError}
                </div>
              )}

              {showBranchForm && !editingBranch && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add New Branch</CardTitle>
                    <CardDescription>Enter branch name</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      setBranchSaving(true)
                      setBranchError(null)

                      try {
                        if (!branchName.trim()) {
                          setBranchError('Branch Name is required')
                          setBranchSaving(false)
                          return
                        }

                        await createBranchMutation({
                          branchName: branchName.trim(),
                          alias: alias.trim() || '', // Pass empty string to explicitly clear alias
                          doNumbering: doNumbering.trim() || 'SOTP1',
                          trNumbering: trNumbering.trim() || undefined,
                        })

                        setBranchName('')
                        setAlias('')
                        setDoNumbering('SOTP1')
                        setTrNumbering('')
                        setShowBranchForm(false)
                      } catch (err) {
                        setBranchError(err instanceof Error ? err.message : 'Failed to save branch')
                      } finally {
                        setBranchSaving(false)
                      }
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="branchName">Branch Name *</Label>
                        <Input
                          id="branchName"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                          required
                          placeholder="Enter branch name"
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <Label htmlFor="alias">Alias</Label>
                        <Input
                          id="alias"
                          value={alias}
                          onChange={(e) => setAlias(e.target.value)}
                          placeholder="Optional display name for tabs"
                          maxLength={50}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          If set, this will be shown in branch tabs instead of branch name
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="doNumbering">DO Numbering Prefix *</Label>
                        <Input
                          id="doNumbering"
                          value={doNumbering}
                          onChange={(e) => setDoNumbering(e.target.value)}
                          required
                          placeholder="SOTP1"
                          maxLength={20}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Prefix only (e.g., "SOTP1"). Full number will be: {doNumbering || 'SOTP1'}-000001
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="trNumbering">TR Numbering Prefix</Label>
                        <Input
                          id="trNumbering"
                          value={trNumbering}
                          onChange={(e) => setTrNumbering(e.target.value)}
                          placeholder="TR1"
                          maxLength={20}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Prefix for Temporary Receipts (e.g., "TR1"). Full number will be: {trNumbering || 'TR1'}-000001
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={branchSaving}>
                          {branchSaving ? 'Saving...' : 'Create Branch'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => {
                          setBranchName('')
                          setAlias('')
                          setDoNumbering('SOTP1')
                          setTrNumbering('')
                          setShowBranchForm(false)
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Branch Edit Modal with Tabs */}
              {showBranchModal && editingBranch && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Edit Branch: {editingBranch.branchName}</CardTitle>
                        <Button variant="ghost" onClick={() => {
                          setShowBranchModal(false)
                          setEditingBranch(null)
                          setBranchModalTab('general')
                        }}>
                          ×
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={branchModalTab} onValueChange={setBranchModalTab}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="general">General</TabsTrigger>
                          <TabsTrigger value="product-template">Product Template</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="mt-4">
                          <form onSubmit={async (e) => {
                            e.preventDefault()
                            setBranchSaving(true)
                            setBranchError(null)

                            try {
                              if (!branchName.trim()) {
                                setBranchError('Branch Name is required')
                                setBranchSaving(false)
                                return
                              }

                              await updateBranchMutation({
                                id: editingBranch._id,
                                branchName: branchName.trim(),
                                alias: alias.trim() || '', // Pass empty string to explicitly clear alias
                                doNumbering: doNumbering.trim() || 'SOTP1',
                                trNumbering: trNumbering.trim() || undefined,
                              })

                              setShowBranchModal(false)
                              setEditingBranch(null)
                            } catch (err) {
                              setBranchError(err instanceof Error ? err.message : 'Failed to save branch')
                            } finally {
                              setBranchSaving(false)
                            }
                          }} className="space-y-4">
                            <div>
                              <Label htmlFor="modal-branchName">Branch Name *</Label>
                              <Input
                                id="modal-branchName"
                                value={branchName}
                                onChange={(e) => setBranchName(e.target.value)}
                                required
                                placeholder="Enter branch name"
                                maxLength={100}
                                disabled={editingBranch ? (branchDoCounts[editingBranch._id] || 0) > 0 : false}
                              />
                            </div>
                            <div>
                              <Label htmlFor="modal-alias">Alias</Label>
                              <Input
                                id="modal-alias"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                placeholder="Optional display name for tabs"
                                maxLength={50}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                If set, this will be shown in branch tabs instead of branch name
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="modal-doNumbering">DO Numbering Prefix *</Label>
                              <Input
                                id="modal-doNumbering"
                                value={doNumbering}
                                onChange={(e) => setDoNumbering(e.target.value)}
                                required
                                placeholder="SOTP1"
                                maxLength={20}
                                disabled={editingBranch ? (branchDoCounts[editingBranch._id] || 0) > 0 : false}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Prefix only (e.g., "SOTP1"). Full number will be: {doNumbering || 'SOTP1'}-000001
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="modal-trNumbering">TR Numbering Prefix</Label>
                              <Input
                                id="modal-trNumbering"
                                value={trNumbering}
                                onChange={(e) => setTrNumbering(e.target.value)}
                                placeholder="TR1"
                                maxLength={20}
                                disabled={editingBranch ? (branchDoCounts[editingBranch._id] || 0) > 0 : false}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Prefix for Temporary Receipts (e.g., "TR1"). Full number will be: {trNumbering || 'TR1'}-000001
                              </p>
                            </div>
                            {branchError && (
                              <div className="text-red-600 text-sm">{branchError}</div>
                            )}
                            <div className="flex gap-2">
                              <Button type="submit" disabled={branchSaving}>
                                {branchSaving ? 'Saving...' : 'Update Branch'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => {
                                setShowBranchModal(false)
                                setEditingBranch(null)
                                setBranchModalTab('general')
                              }}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </TabsContent>
                        <TabsContent value="product-template" className="mt-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600">
                                Pre-set items that will appear when creating delivery orders for this branch.
                                Configure tax codes for NRIC and Passport customers.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open('/dashboard/products', '_blank')}
                              >
                                Open Products Page
                              </Button>
                            </div>
                            {/* Add Product Template Form */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Add Product to Template</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="template-product">Product *</Label>
                                    <select
                                      id="template-product"
                                      value={selectedProductCode}
                                      onChange={async (e) => {
                                        const productCode = e.target.value
                                        console.log('[DEBUG] Product selected:', productCode)
                                        setSelectedProductCode(productCode)
                                        
                                        // Get product from already loaded products list first (more efficient)
                                        if (productCode) {
                                          const productFromList = products.find(p => p.ItemCode === productCode)
                                          if (productFromList) {
                                            const price = productFromList.Price || productFromList.price || 0
                                            console.log('[DEBUG] Found product in list, setting default price to:', price)
                                            setDefaultPrice(Number(price) || 0)
                                          } else {
                                            // Fallback: try API if not found in list
                                            try {
                                              console.log('[DEBUG] Product not in list, fetching from API:', productCode)
                                              const response = await fetch(`/api/autocount/products/${encodeURIComponent(productCode)}`)
                                              console.log('[DEBUG] Product API response status:', response.status)
                                              if (response.ok) {
                                                const data = await response.json()
                                                console.log('[DEBUG] Product data received:', JSON.stringify(data, null, 2))
                                                const product = data.data
                                                if (product) {
                                                  const price = product.Price || product.price || 0
                                                  console.log('[DEBUG] Setting default price to:', price)
                                                  setDefaultPrice(Number(price) || 0)
                                                } else {
                                                  console.log('[DEBUG] No product data found in response')
                                                }
                                              } else {
                                                const errorData = await response.json().catch(() => ({}))
                                                console.error('[DEBUG] Product API error:', errorData)
                                                console.log('[DEBUG] Setting default price to 0 due to API error')
                                                setDefaultPrice(0)
                                              }
                                            } catch (err) {
                                              console.error('[DEBUG] Failed to fetch product details:', err)
                                              setDefaultPrice(0)
                                            }
                                          }
                                        } else {
                                          console.log('[DEBUG] No product selected, resetting price to 0')
                                          setDefaultPrice(0)
                                        }
                                      }}
                                      className="w-full px-3 py-2 border rounded-md"
                                      disabled={loadingProducts}
                                    >
                                      <option value="">Select Product</option>
                                      {products.map((product) => (
                                        <option key={product.ItemCode} value={product.ItemCode}>
                                          {product.ItemCode} - {product.Description || ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <Label htmlFor="template-nric-tax">NRIC Tax Code</Label>
                                    {(() => {
                                      const activeTaxCodes = taxCodes.filter(tc => (tc.IsActive === 'Y' || tc.IsActive === 'T'))
                                      console.log('[DEBUG] Rendering NRIC Tax dropdown - total taxCodes:', taxCodes.length, 'active:', activeTaxCodes.length, 'codes:', activeTaxCodes.map(tc => `${tc.TaxCode}(${tc.IsActive})`))
                                      return (
                                        <select
                                          id="template-nric-tax"
                                          value={nricTaxCode}
                                          onChange={(e) => {
                                            console.log('[DEBUG] NRIC tax code selected:', e.target.value)
                                            setNricTaxCode(e.target.value)
                                          }}
                                          className="w-full px-3 py-2 border rounded-md"
                                        >
                                          <option value="">None</option>
                                          {activeTaxCodes.map((tc) => (
                                            <option key={tc.TaxCode} value={tc.TaxCode}>
                                              {tc.TaxCode} - {tc.Description || ''} ({tc.TaxRate}%)
                                            </option>
                                          ))}
                                        </select>
                                      )
                                    })()}
                                  </div>
                                  <div>
                                    <Label htmlFor="template-passport-tax">Passport Tax Code</Label>
                                    {(() => {
                                      const activeTaxCodes = taxCodes.filter(tc => (tc.IsActive === 'Y' || tc.IsActive === 'T'))
                                      console.log('[DEBUG] Rendering Passport Tax dropdown - total taxCodes:', taxCodes.length, 'active:', activeTaxCodes.length, 'codes:', activeTaxCodes.map(tc => `${tc.TaxCode}(${tc.IsActive})`))
                                      return (
                                        <select
                                          id="template-passport-tax"
                                          value={passportTaxCode}
                                          onChange={(e) => {
                                            console.log('[DEBUG] Passport tax code selected:', e.target.value)
                                            setPassportTaxCode(e.target.value)
                                          }}
                                          className="w-full px-3 py-2 border rounded-md"
                                        >
                                          <option value="">None</option>
                                          {activeTaxCodes.map((tc) => (
                                            <option key={tc.TaxCode} value={tc.TaxCode}>
                                              {tc.TaxCode} - {tc.Description || ''} ({tc.TaxRate}%)
                                            </option>
                                          ))}
                                        </select>
                                      )
                                    })()}
                                  </div>
                                  <div>
                                    <Label htmlFor="template-default-price">Default Price</Label>
                                    <Input
                                      id="template-default-price"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={defaultPrice}
                                      onChange={(e) => setDefaultPrice(parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div className="col-span-2 flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        if (!selectedProductCode) {
                                          alert('Please select a product')
                                          return
                                        }
                                        if (!editingBranch) return
                                        
                                        try {
                                          const editingTemplate = editingTemplateId 
                                            ? productTemplates.find(t => t._id === editingTemplateId)
                                            : null
                                          
                                          const seq = editingTemplate 
                                            ? editingTemplate.seq 
                                            : (productTemplates.length > 0 
                                                ? Math.max(...productTemplates.map(t => t.seq || 0)) + 1
                                                : 1)
                                          
                                          await upsertTemplate({
                                            branchId: editingBranch._id,
                                            itemCode: selectedProductCode,
                                            nricTaxCode: nricTaxCode || undefined,
                                            passportTaxCode: passportTaxCode || undefined,
                                            defaultQty: 0, // Always 0
                                            defaultPrice: defaultPrice || undefined,
                                            seq: seq,
                                          })
                                          
                                          // Reset form
                                          setSelectedProductCode('')
                                          setNricTaxCode('')
                                          setPassportTaxCode('')
                                          setDefaultPrice(0)
                                          setEditingTemplateId(null)
                                        } catch (err) {
                                          alert(err instanceof Error ? err.message : 'Failed to save product template')
                                        }
                                      }}
                                    >
                                      {editingTemplateId ? 'Update Template' : 'Add to Template'}
                                    </Button>
                                    {editingTemplateId && (
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedProductCode('')
                                          setNricTaxCode('')
                                          setPassportTaxCode('')
                                          setDefaultPrice(0)
                                          setEditingTemplateId(null)
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Product Templates List */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Template Products</CardTitle>
                              </CardHeader>
                              <CardContent>
                                {productTemplates.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    No products in template. Add products above.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                      <thead>
                                        <tr className="border-b bg-gray-50">
                                          <th className="text-left p-2 font-semibold">Item Code</th>
                                          <th className="text-left p-2 font-semibold">Description</th>
                                          <th className="text-left p-2 font-semibold">NRIC Tax</th>
                                          <th className="text-left p-2 font-semibold">Passport Tax</th>
                                          <th className="text-left p-2 font-semibold">Default Price</th>
                                          <th className="text-left p-2 font-semibold">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {productTemplates.map((template) => {
                                          const product = products.find(p => p.ItemCode === template.itemCode)
                                          // Find tax codes with case-insensitive matching to handle any inconsistencies
                                          const nricTax = template.nricTaxCode 
                                            ? taxCodes.find(tc => tc.TaxCode?.toUpperCase() === template.nricTaxCode?.toUpperCase())
                                            : null
                                          const passportTax = template.passportTaxCode
                                            ? taxCodes.find(tc => tc.TaxCode?.toUpperCase() === template.passportTaxCode?.toUpperCase())
                                            : null
                                          
                                          return (
                                            <tr key={template._id} className="border-b hover:bg-gray-50">
                                              <td className="p-2">{template.itemCode}</td>
                                              <td className="p-2">{product?.Description || '-'}</td>
                                              <td className="p-2">
                                                {nricTax ? `${nricTax.TaxCode} (${nricTax.TaxRate}%)` : '-'}
                                              </td>
                                              <td className="p-2">
                                                {passportTax ? `${passportTax.TaxCode} (${passportTax.TaxRate}%)` : '-'}
                                              </td>
                                              <td className="p-2">
                                                {template.defaultPrice ? `RM${template.defaultPrice.toFixed(2)}` : '-'}
                                              </td>
                                              <td className="p-2">
                                                <div className="flex gap-2">
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      console.log('[DEBUG] Edit template clicked:', template)
                                                      // Load template data into form for editing
                                                      setSelectedProductCode(template.itemCode)
                                                      setNricTaxCode(template.nricTaxCode || '')
                                                      setPassportTaxCode(template.passportTaxCode || '')
                                                      const existingPrice = template.defaultPrice || 0
                                                      console.log('[DEBUG] Template existing price:', existingPrice)
                                                      setDefaultPrice(existingPrice)
                                                      setEditingTemplateId(template._id)
                                                      
                                                      // Get product from already loaded products list first (more efficient)
                                                      const productFromList = products.find(p => p.ItemCode === template.itemCode)
                                                      if (productFromList) {
                                                        const productPrice = productFromList.Price || productFromList.price || 0
                                                        console.log('[DEBUG] Found product in list for edit, price:', productPrice)
                                                        // Use template price if exists, otherwise use product price
                                                        if (!existingPrice || existingPrice === 0) {
                                                          console.log('[DEBUG] No existing price, setting to product price:', productPrice)
                                                          setDefaultPrice(Number(productPrice) || 0)
                                                        } else {
                                                          console.log('[DEBUG] Keeping existing template price:', existingPrice)
                                                        }
                                                      } else {
                                                        // Fallback: try API if not found in list
                                                        try {
                                                          console.log('[DEBUG] Product not in list, fetching from API for edit:', template.itemCode)
                                                          const response = await fetch(`/api/autocount/products/${encodeURIComponent(template.itemCode)}`)
                                                          console.log('[DEBUG] Edit product API response status:', response.status)
                                                          if (response.ok) {
                                                            const data = await response.json()
                                                            console.log('[DEBUG] Edit product data received:', JSON.stringify(data, null, 2))
                                                            const product = data.data
                                                            if (product) {
                                                              const productPrice = product.Price || product.price || 0
                                                              console.log('[DEBUG] Product price from API:', productPrice)
                                                              // Use template price if exists, otherwise use product price
                                                              if (!existingPrice || existingPrice === 0) {
                                                                console.log('[DEBUG] No existing price, setting to product price:', productPrice)
                                                                setDefaultPrice(Number(productPrice) || 0)
                                                              } else {
                                                                console.log('[DEBUG] Keeping existing template price:', existingPrice)
                                                              }
                                                            }
                                                          }
                                                        } catch (err) {
                                                          console.error('[DEBUG] Failed to fetch product details for edit:', err)
                                                        }
                                                      }
                                                      
                                                      // Scroll to form
                                                      document.getElementById('template-product')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                    }}
                                                  >
                                                    Edit
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      if (!confirm('Remove this product from template?')) return
                                                      try {
                                                        await removeTemplate({ templateId: template._id })
                                                        // Clear edit mode if removing the template being edited
                                                        if (editingTemplateId === template._id) {
                                                          setSelectedProductCode('')
                                                          setNricTaxCode('')
                                                          setPassportTaxCode('')
                                                          setDefaultPrice(0)
                                                          setEditingTemplateId(null)
                                                        }
                                                      } catch (err) {
                                                        alert(err instanceof Error ? err.message : 'Failed to remove template')
                                                      }
                                                    }}
                                                  >
                                                    Remove
                                                  </Button>
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
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              )}

              {branches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No branches found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-semibold">Branch Name</th>
                        <th className="text-left p-2 font-semibold">Alias</th>
                        <th className="text-left p-2 font-semibold">DO Prefix</th>
                        <th className="text-left p-2 font-semibold">TR Prefix</th>
                        <th className="text-left p-2 font-semibold">Created</th>
                        <th className="text-left p-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((branch) => {
                        const doCount = branchDoCounts[branch._id] || 0
                        const canEdit = permissions.canCreateBranch
                        const canDelete = permissions.canDeleteBranch && doCount === 0
                        
                        return (
                          <tr key={branch._id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{branch.branchName}</td>
                            <td className="p-2">{branch.alias || '-'}</td>
                            <td className="p-2">{branch.doNumbering || 'SOTP1'}</td>
                            <td className="p-2">{branch.trNumbering || '-'}</td>
                            <td className="p-2">
                              {new Date(branch.createdAt).toLocaleDateString('en-GB')}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                {permissions.canCreateBranch ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingBranch(branch)
                                      setBranchName(branch.branchName)
                                      setAlias(branch.alias || '')
                                      setDoNumbering(branch.doNumbering || 'SOTP1')
                                      setTrNumbering(branch.trNumbering || '')
                                      setBranchModalTab('general')
                                      setShowBranchModal(true)
                                    }}
                                  >
                                    Edit
                                  </Button>
                                ) : null}
                                {permissions.canDeleteBranch ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (doCount > 0) {
                                        setBranchError(`Cannot delete branch. It has ${doCount} delivery order(s).`)
                                        return
                                      }
                                      if (!confirm('Are you sure you want to delete this branch?')) {
                                        return
                                      }
                                      try {
                                        await deleteBranchMutation({ 
                                          id: branch._id,
                                          doCount: doCount
                                        })
                                      } catch (err) {
                                        setBranchError(err instanceof Error ? err.message : 'Failed to delete branch')
                                      }
                                    }}
                                    disabled={!canDelete}
                                    className="text-red-600 hover:text-red-700"
                                    title={!canDelete && doCount > 0 ? `Cannot delete: Branch has ${doCount} delivery order(s)` : ''}
                                  >
                                    Delete
                                  </Button>
                                ) : null}
                                {doCount > 0 && (
                                  <span className="text-xs text-amber-600" title={`This branch has ${doCount} delivery order(s)`}>
                                    ⚠️ {doCount} DO(s)
                                  </span>
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
        </TabsContent>

        {/* Tax Code Retrieving Page (TCRP) */}
        <TabsContent value="tax-codes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Code Retrieving Page (TCRP)</CardTitle>
              <CardDescription>Manage tax codes and their rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Add Tax Code Form */}
                <form onSubmit={handleTaxCodeSubmit} className="space-y-4 border-b pb-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="taxCode">Tax Code *</Label>
                      <Input
                        id="taxCode"
                        value={taxCodeForm.TaxCode}
                        onChange={(e) => setTaxCodeForm({ ...taxCodeForm, TaxCode: e.target.value })}
                        required
                        maxLength={14}
                        placeholder="e.g., SR"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxRate">Tax Rate *</Label>
                      <Input
                        id="taxRate"
                        type="number"
                        step="0.01"
                        value={taxCodeForm.TaxRate}
                        onChange={(e) => setTaxCodeForm({ ...taxCodeForm, TaxRate: e.target.value })}
                        required
                        placeholder="e.g., 6.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxDescription">Description</Label>
                      <Input
                        id="taxDescription"
                        value={taxCodeForm.Description}
                        onChange={(e) => setTaxCodeForm({ ...taxCodeForm, Description: e.target.value })}
                        maxLength={120}
                        placeholder="Tax code description"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Adding...' : 'Add Tax Code'}
                  </Button>
                </form>

                {/* Tax Codes Table */}
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Tax Codes</h3>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading tax codes...</div>
                  ) : taxCodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No tax codes found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold">Tax Code</th>
                            <th className="text-left p-2 font-semibold">Description</th>
                            <th className="text-right p-2 font-semibold">Tax Rate (%)</th>
                            <th className="text-left p-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taxCodes.map((taxCode) => (
                            <tr key={taxCode.TaxCode} className="border-b hover:bg-gray-50">
                              <td className="p-2">{taxCode.TaxCode}</td>
                              <td className="p-2">{taxCode.Description || '-'}</td>
                              <td className="p-2 text-right">
                                {taxCode.TaxRate != null && taxCode.TaxRate !== undefined
                                  ? `${taxCode.TaxRate.toFixed(2)}%`
                                  : '-'}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    taxCode.IsActive === 'Y' || taxCode.IsActive === 'T'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {taxCode.IsActive === 'Y' || taxCode.IsActive === 'T' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* E-invoice Classification Setting Page (EICSP) */}
        <TabsContent value="classifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>E-invoice Classification Setting Page (EICSP)</CardTitle>
              <CardDescription>Manage e-invoice classification codes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Add Classification Form */}
                <form onSubmit={handleClassificationSubmit} className="space-y-4 border-b pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="classificationCode">Code *</Label>
                      <Input
                        id="classificationCode"
                        value={classificationForm.Code}
                        onChange={(e) => setClassificationForm({ ...classificationForm, Code: e.target.value })}
                        required
                        maxLength={3}
                        placeholder="e.g., A01"
                      />
                    </div>
                    <div>
                      <Label htmlFor="classificationDescription">Description</Label>
                      <Input
                        id="classificationDescription"
                        value={classificationForm.Description}
                        onChange={(e) => setClassificationForm({ ...classificationForm, Description: e.target.value })}
                        maxLength={100}
                        placeholder="Classification description"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Adding...' : 'Add Classification'}
                  </Button>
                </form>

                {/* Classifications Table */}
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Classifications</h3>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading classifications...</div>
                  ) : classifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No classifications found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold">Code</th>
                            <th className="text-left p-2 font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classifications.map((classification) => (
                            <tr key={classification.Code} className="border-b hover:bg-gray-50">
                              <td className="p-2">{classification.Code}</td>
                              <td className="p-2">{classification.Description || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
      </div>
    </>
  )
}
