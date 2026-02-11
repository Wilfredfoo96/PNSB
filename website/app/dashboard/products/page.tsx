'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/dashboard/PageHeader'

interface Product {
  AutoKey: number
  ItemCode: string
  Description: string | null
  Desc2: string | null
  ItemCategory: string | null
  ItemBrand: string | null
  ItemType: string | null
  ItemGroup: string | null
  SalesUOM: string
  PurchaseUOM: string
  ReportUOM: string
  BaseUOM: string
  TaxCode: string | null
  StockControl: string
  HasSerialNo: string
  HasBatchNo: string
  IsActive: string
  Discontinued: string
  LastModified: string
  Cost: number | null
  Price: number | null
  Classification: string | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productDetail, setProductDetail] = useState<any | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    ItemCode: '',
    Description: '',
    ItemCategory: '',
    ItemType: '',
    ItemGroup: '',
    SalesUOM: '',
    PurchaseUOM: '',
    ReportUOM: '',
    BaseUOM: '',
    Cost: '',
    Price: '',
    DiscountInfo: '',
    StockControl: 'N',
    HasSerialNo: 'N',
    HasBatchNo: 'N',
    IsActive: 'Y',
  })

  // Fetch products
  const fetchProducts = async (
    pageNum: number = 1,
    searchTerm: string = '',
    categoryFilter: string = '',
    brandFilter: string = '',
    typeFilter: string = ''
  ) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      })
      if (searchTerm) params.append('search', searchTerm)
      if (categoryFilter) params.append('category', categoryFilter)
      if (brandFilter) params.append('brand', brandFilter)
      if (typeFilter) params.append('type', typeFilter)

      const response = await fetch(`/api/autocount/products-v2?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch products')
      }

      const data = await response.json()
      setProducts(data.data || [])
      setTotal(data.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchProducts(1, search, category, brand, type)
  }, [])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(1, search, category, brand, type)
  }

  // Handle view product
  const handleViewProduct = async (itemCode: string) => {
    try {
      if (!itemCode || itemCode.trim() === '') {
        throw new Error('Item Code is required')
      }
      const response = await fetch(`/api/autocount/products/${encodeURIComponent(itemCode.trim())}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch product details')
      }
      const data = await response.json()
      if (!data || !data.data) {
        throw new Error('Invalid response format from server')
      }
      setProductDetail(data.data)
      setSelectedProduct(data.data)
    } catch (err) {
      console.error('Error fetching product:', err)
      alert(err instanceof Error ? err.message : 'Failed to load product details')
    }
  }

  // Handle create product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Product Create] Form submitted', { formData })
    setSaving(true)
    setError(null)

    try {
      // Only ItemCode and SalesUOM are required by backend
      if (!formData.ItemCode || !formData.SalesUOM) {
        console.warn('[Product Create] Validation failed - missing required fields]', formData)
        setError('ItemCode and SalesUOM are required')
        setSaving(false)
        return
      }

      // Map to backend format
      const requestBody = {
        product: {
          ItemCode: formData.ItemCode,
          Description: formData.Description || null,
          ItemType: formData.ItemType || null,
          ItemCategory: formData.ItemCategory || null,
          ItemGroup: formData.ItemGroup || null,
          SalesUOM: formData.SalesUOM, // Required - maps to UOM in backend
          PurchaseUOM: formData.PurchaseUOM || formData.SalesUOM, // Use SalesUOM as fallback
          ReportUOM: formData.ReportUOM || formData.SalesUOM, // Use SalesUOM as fallback
          BaseUOM: formData.BaseUOM || formData.SalesUOM, // Use SalesUOM as fallback
          Cost: formData.Cost ? parseFloat(formData.Cost) : null,
          Price: formData.Price ? parseFloat(formData.Price) : null,
          DiscountInfo: formData.DiscountInfo || null,
          StockControl: formData.StockControl || 'N',
          HasSerialNo: formData.HasSerialNo || 'N',
          HasBatchNo: formData.HasBatchNo || 'N',
          IsActive: formData.IsActive || 'Y',
        },
        uoms: [],
      }
      console.log('[Product Create] Sending request to API', requestBody)

      const response = await fetch('/api/autocount/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[Product Create] API response status', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Product Create] API error', errorData)
        throw new Error(errorData.error || 'Failed to create product')
      }

      const responseData = await response.json()
      console.log('[Product Create] Success', responseData)

      setShowAddModal(false)
      console.log('[Product Create] Resetting form data')
      setFormData({
        ItemCode: '',
        Description: '',
        ItemCategory: '',
        ItemType: '',
        ItemGroup: '',
        SalesUOM: '',
        PurchaseUOM: '',
        ReportUOM: '',
        BaseUOM: '',
        Cost: '',
        Price: '',
        DiscountInfo: '',
        StockControl: 'N',
        HasSerialNo: 'N',
        HasBatchNo: 'N',
        IsActive: 'Y',
      })
      await fetchProducts(page, search, category, brand, type)
      alert('Product created successfully')
    } catch (err) {
      console.error('[Product Create] Error occurred', err)
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setSaving(false)
      console.log('[Product Create] Form submission completed')
    }
  }


  // Handle delete
  const handleDelete = async (itemCode: string) => {
    if (!confirm(`Are you sure you want to delete product ${itemCode}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/autocount/products/${encodeURIComponent(itemCode)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete product')
      }

      const result = await response.json()
      alert(result.message || 'Product deleted successfully')
      await fetchProducts(page, search, category, brand, type)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  return (
    <>
      <PageHeader
        title="Products & Services"
        description="Manage your inventory and service offerings."
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
                  placeholder="Search by item code, description, or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-slate-200"
                />
              </form>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200 w-32"
              />
              <input
                type="text"
                placeholder="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200 w-32"
              />
              <button
                onClick={() => fetchProducts(page, search, category, brand, type)}
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
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {search || category || brand ? 'No products found matching your filters' : 'No products found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Code</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Group</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Type</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {products.map((product) => (
                      <tr key={product.ItemCode} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-semibold text-sm text-primary">{product.ItemCode}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{product.Description || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{product.ItemGroup || '-'}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{product.ItemType || '-'}</td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {product.Cost !== null && product.Cost !== undefined
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Number(product.Cost))
                            : '-'}
                        </td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {product.Price !== null && product.Price !== undefined
                            ? new Intl.NumberFormat('en-MY', {
                                style: 'currency',
                                currency: 'MYR',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Number(product.Price))
                            : '-'}
                        </td>
                        <td className="px-6 py-3">
                          {product.Discontinued === 'Y' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50">
                              Inactive
                            </span>
                          ) : product.IsActive === 'Y' || product.IsActive === 'T' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Inactive
                            </span>
                          )}
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
                    onClick={() => fetchProducts(page - 1, search, category, brand, type)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-not-allowed border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-white bg-[#1e40af] rounded-lg border border-[#1e40af] shadow-sm">
                    {page}
                  </button>
                  <button
                    onClick={() => fetchProducts(page + 1, search, category, brand, type)}
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

      {/* View Product Modal */}
      {productDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Details: {productDetail.ItemCode}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setProductDetail(null)}>
                    ×
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <Label className="text-sm font-semibold">Item Code</Label>
                    <p className="text-sm">{productDetail.ItemCode}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Description</Label>
                    <p className="text-sm">{productDetail.Description || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Category</Label>
                    <p className="text-sm">{productDetail.ItemCategory || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Brand</Label>
                    <p className="text-sm">{productDetail.ItemBrand || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Type</Label>
                    <p className="text-sm">{productDetail.ItemType || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Tax Code</Label>
                    <p className="text-sm">{productDetail.TaxCode || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Sales UOM</Label>
                    <p className="text-sm">{productDetail.SalesUOM || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Purchase UOM</Label>
                    <p className="text-sm">{productDetail.PurchaseUOM || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Stock Control</Label>
                    <p className="text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          productDetail.StockControl === 'Y'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {productDetail.StockControl === 'Y' ? 'Yes' : 'No'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Status</Label>
                    <p className="text-sm">
                      {productDetail.Discontinued === 'Y' ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          Discontinued
                        </span>
                      ) : productDetail.IsActive === 'Y' ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* UOMs */}
                {productDetail.uoms && productDetail.uoms.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Units of Measure (UOMs)</Label>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold text-sm">UOM</th>
                            <th className="text-right p-2 font-semibold text-sm">Rate</th>
                            <th className="text-right p-2 font-semibold text-sm">Price</th>
                            <th className="text-right p-2 font-semibold text-sm">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDetail.uoms.map((uom: any) => (
                            <tr key={uom.UOM} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm">{uom.UOM}</td>
                              <td className="p-2 text-sm text-right">{uom.Rate || '-'}</td>
                              <td className="p-2 text-sm text-right">
                                {uom.Price
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(uom.Price))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {uom.Cost
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(uom.Cost))
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Prices */}
                {productDetail.prices && productDetail.prices.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Price Lists</Label>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold text-sm">Price Category</th>
                            <th className="text-left p-2 font-semibold text-sm">Account</th>
                            <th className="text-left p-2 font-semibold text-sm">UOM</th>
                            <th className="text-right p-2 font-semibold text-sm">Fixed Price</th>
                            <th className="text-right p-2 font-semibold text-sm">Price 1</th>
                            <th className="text-right p-2 font-semibold text-sm">Price 2</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDetail.prices.map((price: any) => (
                            <tr key={price.ItemPriceKey} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm">{price.PriceCategory || '-'}</td>
                              <td className="p-2 text-sm">{price.AccNo || '-'}</td>
                              <td className="p-2 text-sm">{price.UOM || '-'}</td>
                              <td className="p-2 text-sm text-right">
                                {price.FixedPrice
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(price.FixedPrice))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {price.Price1
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(price.Price1))
                                  : '-'}
                              </td>
                              <td className="p-2 text-sm text-right">
                                {price.Price2
                                  ? new Intl.NumberFormat('en-MY', {
                                      style: 'currency',
                                      currency: 'MYR',
                                    }).format(Number(price.Price2))
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Product</CardTitle>
                <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ItemCode">Item Code *</Label>
                    <Input
                      id="ItemCode"
                      value={formData.ItemCode}
                      onChange={(e) => setFormData({ ...formData, ItemCode: e.target.value })}
                      required
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <Label htmlFor="Description">Description</Label>
                    <Input
                      id="Description"
                      value={formData.Description}
                      onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ItemCategory">Category</Label>
                    <Input
                      id="ItemCategory"
                      value={formData.ItemCategory}
                      onChange={(e) => setFormData({ ...formData, ItemCategory: e.target.value })}
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ItemGroup">Item Group</Label>
                    <Input
                      id="ItemGroup"
                      value={formData.ItemGroup}
                      onChange={(e) => setFormData({ ...formData, ItemGroup: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ItemType">Item Type</Label>
                    <Input
                      id="ItemType"
                      value={formData.ItemType}
                      onChange={(e) => setFormData({ ...formData, ItemType: e.target.value })}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="DiscountInfo">Discount Info</Label>
                    <Input
                      id="DiscountInfo"
                      value={formData.DiscountInfo}
                      onChange={(e) => setFormData({ ...formData, DiscountInfo: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="SalesUOM">Sales UOM *</Label>
                    <Input
                      id="SalesUOM"
                      value={formData.SalesUOM}
                      onChange={(e) => setFormData({ ...formData, SalesUOM: e.target.value })}
                      required
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="PurchaseUOM">Purchase UOM *</Label>
                    <Input
                      id="PurchaseUOM"
                      value={formData.PurchaseUOM}
                      onChange={(e) => setFormData({ ...formData, PurchaseUOM: e.target.value })}
                      required
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ReportUOM">Report UOM *</Label>
                    <Input
                      id="ReportUOM"
                      value={formData.ReportUOM}
                      onChange={(e) => setFormData({ ...formData, ReportUOM: e.target.value })}
                      required
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="BaseUOM">Base UOM *</Label>
                    <Input
                      id="BaseUOM"
                      value={formData.BaseUOM}
                      onChange={(e) => setFormData({ ...formData, BaseUOM: e.target.value })}
                      required
                      maxLength={8}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="Cost">Cost</Label>
                    <Input
                      id="Cost"
                      type="number"
                      step="0.01"
                      value={formData.Cost}
                      onChange={(e) => setFormData({ ...formData, Cost: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="Price">Price</Label>
                    <Input
                      id="Price"
                      type="number"
                      step="0.01"
                      value={formData.Price}
                      onChange={(e) => setFormData({ ...formData, Price: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="DiscountInfo">Discount Info</Label>
                  <Input
                    id="DiscountInfo"
                    value={formData.DiscountInfo}
                    onChange={(e) => setFormData({ ...formData, DiscountInfo: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="StockControl">Stock Control</Label>
                    <select
                      id="StockControl"
                      value={formData.StockControl}
                      onChange={(e) => setFormData({ ...formData, StockControl: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </div>
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
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Product'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

    </>
  )
}
