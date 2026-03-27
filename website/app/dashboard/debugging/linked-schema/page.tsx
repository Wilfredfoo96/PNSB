'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

// Helper function to get all unique keys from an array of objects
const getAllKeys = (data: any[]): string[] => {
  const keysSet = new Set<string>()
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => keysSet.add(key))
    }
  })
  return Array.from(keysSet).sort()
}

// Helper function to format cell value
const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '-'
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  
  if (typeof value === 'number') {
    // Check if it's a date timestamp (milliseconds since epoch)
    if (value > 1000000000000) {
      try {
        return new Date(value).toLocaleString('en-GB')
      } catch {
        return value.toString()
      }
    }
    return value.toString()
  }
  
  if (typeof value === 'string') {
    // Try to parse as date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-GB')
        }
      } catch {
        // Not a valid date, continue
      }
    }
    return value
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[Object]'
    }
  }
  
  return String(value)
}

export default function LinkedSchemaPage() {
  const userRole = useUserRole()
  const router = useRouter()
  const permissions = getPermissionsForRole(userRole)

  // Check permissions
  useEffect(() => {
    if (userRole !== null && !permissions.canAccessDebugging) {
      router.push('/dashboard')
    }
  }, [userRole, permissions.canAccessDebugging, router])

  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState({ deliveryOrders: false, customers: false, products: false })
  const [error, setError] = useState({ deliveryOrders: '', customers: '', products: '' })
  const [expandedSections, setExpandedSections] = useState({ deliveryOrders: true, customers: true, products: true })
  const [search, setSearch] = useState({ deliveryOrders: '', customers: '', products: '' })
  const [page, setPage] = useState({ deliveryOrders: 1, customers: 1, products: 1 })
  const [limit] = useState(20)

  const fetchDeliveryOrders = async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(prev => ({ ...prev, deliveryOrders: true }))
    setError(prev => ({ ...prev, deliveryOrders: '' }))
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      })
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      const response = await fetch(`/api/autocount/delivery-orders-v2?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch delivery orders')
      }
      const data = await response.json()
      setDeliveryOrders(data.data || [])
    } catch (err) {
      setError(prev => ({ ...prev, deliveryOrders: err instanceof Error ? err.message : 'Failed to fetch delivery orders' }))
    } finally {
      setLoading(prev => ({ ...prev, deliveryOrders: false }))
    }
  }

  const fetchCustomers = async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(prev => ({ ...prev, customers: true }))
    setError(prev => ({ ...prev, customers: '' }))
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
        throw new Error('Failed to fetch customers')
      }
      const data = await response.json()
      setCustomers(data.data || [])
    } catch (err) {
      setError(prev => ({ ...prev, customers: err instanceof Error ? err.message : 'Failed to fetch customers' }))
    } finally {
      setLoading(prev => ({ ...prev, customers: false }))
    }
  }

  const fetchProducts = async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(prev => ({ ...prev, products: true }))
    setError(prev => ({ ...prev, products: '' }))
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      })
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      const response = await fetch(`/api/autocount/products-v2?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data.data || [])
    } catch (err) {
      setError(prev => ({ ...prev, products: err instanceof Error ? err.message : 'Failed to fetch products' }))
    } finally {
      setLoading(prev => ({ ...prev, products: false }))
    }
  }

  useEffect(() => {
    if (expandedSections.deliveryOrders) {
      fetchDeliveryOrders(page.deliveryOrders, search.deliveryOrders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSections.deliveryOrders, page.deliveryOrders, search.deliveryOrders])

  useEffect(() => {
    if (expandedSections.customers) {
      fetchCustomers(page.customers, search.customers)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSections.customers, page.customers, search.customers])

  useEffect(() => {
    if (expandedSections.products) {
      fetchProducts(page.products, search.products)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSections.products, page.products, search.products])

  const toggleSection = (section: 'deliveryOrders' | 'customers' | 'products') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Get all unique keys for each data type
  const deliveryOrderKeys = useMemo(() => getAllKeys(deliveryOrders), [deliveryOrders])
  const customerKeys = useMemo(() => getAllKeys(customers), [customers])
  const productKeys = useMemo(() => getAllKeys(products), [products])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Linked Schema</h1>
        <p className="text-sm text-muted-foreground">
          View actual data values from Delivery Orders, Customers, and Products linked to AutoCount
        </p>
      </div>

      {/* Delivery Orders Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Delivery Orders</CardTitle>
              <CardDescription className="text-xs">
                {deliveryOrders.length} record{deliveryOrders.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={search.deliveryOrders}
                onChange={(e) => {
                  setSearch(prev => ({ ...prev, deliveryOrders: e.target.value }))
                  setPage(prev => ({ ...prev, deliveryOrders: 1 }))
                }}
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSection('deliveryOrders')}
              >
                {expandedSections.deliveryOrders ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.deliveryOrders && (
          <CardContent className="space-y-4">
            {loading.deliveryOrders && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading delivery orders...
              </div>
            )}
            {error.deliveryOrders && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                {error.deliveryOrders}
              </div>
            )}
            {!loading.deliveryOrders && !error.deliveryOrders && deliveryOrders.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      {deliveryOrderKeys.map((key) => (
                        <th key={key} className="text-left p-2 font-semibold whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.map((doItem, idx) => (
                      <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        {deliveryOrderKeys.map((key) => (
                          <td key={key} className="p-2 break-words max-w-xs">
                            {formatCellValue(doItem[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading.deliveryOrders && !error.deliveryOrders && deliveryOrders.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No delivery orders found
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Customers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription className="text-xs">
                {customers.length} record{customers.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={search.customers}
                onChange={(e) => {
                  setSearch(prev => ({ ...prev, customers: e.target.value }))
                  setPage(prev => ({ ...prev, customers: 1 }))
                }}
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSection('customers')}
              >
                {expandedSections.customers ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.customers && (
          <CardContent className="space-y-4">
            {loading.customers && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading customers...
              </div>
            )}
            {error.customers && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                {error.customers}
              </div>
            )}
            {!loading.customers && !error.customers && customers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      {customerKeys.map((key) => (
                        <th key={key} className="text-left p-2 font-semibold whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer, idx) => (
                      <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        {customerKeys.map((key) => (
                          <td key={key} className="p-2 break-words max-w-xs">
                            {formatCellValue(customer[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading.customers && !error.customers && customers.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No customers found
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription className="text-xs">
                {products.length} record{products.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={search.products}
                onChange={(e) => {
                  setSearch(prev => ({ ...prev, products: e.target.value }))
                  setPage(prev => ({ ...prev, products: 1 }))
                }}
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSection('products')}
              >
                {expandedSections.products ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.products && (
          <CardContent className="space-y-4">
            {loading.products && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading products...
              </div>
            )}
            {error.products && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                {error.products}
              </div>
            )}
            {!loading.products && !error.products && products.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      {productKeys.map((key) => (
                        <th key={key} className="text-left p-2 font-semibold whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, idx) => (
                      <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        {productKeys.map((key) => (
                          <td key={key} className="p-2 break-words max-w-xs">
                            {formatCellValue(product[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading.products && !error.products && products.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No products found
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
