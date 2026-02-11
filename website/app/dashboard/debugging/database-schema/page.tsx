'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface TableColumn {
  COLUMN_NAME: string
  DATA_TYPE: string
  IS_NULLABLE: string
  CHARACTER_MAXIMUM_LENGTH: number | null
  IS_IDENTITY?: number | null
}

interface TableSchema {
  tableName: string
  columns: TableColumn[]
}

// Tables from AUTOCOUNT_TABLES_REFERENCE.md
// Note: Some tables may not exist in all AutoCount installations
// Tables marked with * are confirmed to exist, others may need verification
const tablesToExplore = {
  'Customers': [
    'Debtor', // * Confirmed
    // Note: The following tables may not exist or have different names:
    // 'DebtorAddress', 'DebtorContact', 'DebtorCreditLimit', 'DebtorTerms', 'DebtorCategory'
  ],
  'Invoices': [
    'ARInvoice', // * Confirmed
    'ARInvoiceDTL', // * Confirmed
    'SO', // * Confirmed
    'SODTL', // * Confirmed
    'TaxCode', // * Confirmed
    'Currency', // * Confirmed
    // Note: The following tables may not exist or have different names:
    // 'SalesPerson', 'PaymentTerms'
  ],
  'Products/Services': [
    'Item', // * Confirmed
    'ItemCategory', // * Confirmed
    'ItemBrand', // * Confirmed
    'ItemUOM', // * Confirmed
    'ItemPrice', // * Confirmed
    // Note: The following tables may not exist or have different names:
    // 'ItemStock', 'ItemSupplier', 'ItemLocation'
  ],
  'Delivery Orders': [
    'DO', // * Confirmed
    'DODTL', // * Confirmed
  ],
  'Temporary Receipts': [
    // Note: Receipt tables may have different names. Common variations:
    // 'ARReceipt', 'ARReceiptDTL', 'Receipt', 'ReceiptDetail', 
    // 'TemporaryReceipt', 'TemporaryReceiptDetail', 'ARPayment', 'ARPaymentDTL'
    // Use Database Explorer to search for tables containing 'Receipt' or 'Payment'
  ],
  'Common Supporting': [
    'Currency', // * Confirmed
    'TaxCode', // * Confirmed
    'PaymentMethod', // * Confirmed
    // Note: The following tables may not exist or have different names:
    // 'UOM', 'Unit', 'SalesPerson', 'PaymentTerms', 'Bank', 'User', 'UserMaster'
  ],
}

export default function DatabaseSchemaPage() {
  const userRole = useUserRole()
  const router = useRouter()
  const permissions = getPermissionsForRole(userRole)

  // Check permissions
  useEffect(() => {
    if (userRole !== null && !permissions.canAccessDebugging) {
      router.push('/dashboard')
    }
  }, [userRole, permissions.canAccessDebugging, router])
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<Record<string, string>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const fetchSchema = async (tableName: string) => {
    if (schemas[tableName] || loading[tableName]) return

    setLoading(prev => ({ ...prev, [tableName]: true }))
    setError(prev => ({ ...prev, [tableName]: '' }))

    try {
      const response = await fetch(`/api/autocount/schema?table=${tableName}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Table ${tableName} not found`)
      }

      const data = await response.json()
      setSchemas(prev => ({
        ...prev,
        [tableName]: {
          tableName,
          columns: data.data?.columns || [],
        },
      }))
    } catch (err) {
      setError(prev => ({
        ...prev,
        [tableName]: err instanceof Error ? err.message : 'Failed to fetch schema',
      }))
    } finally {
      setLoading(prev => ({ ...prev, [tableName]: false }))
    }
  }

  const fetchAllInSection = async (sectionName: string, tableNames: string[]) => {
    for (const tableName of tableNames) {
      await fetchSchema(tableName)
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }))

    // Auto-fetch all tables in section when expanded
    if (!expandedSections[sectionName]) {
      fetchAllInSection(sectionName, tablesToExplore[sectionName as keyof typeof tablesToExplore])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Database Schema</h1>
        <p className="text-sm text-muted-foreground">
          Explore database schemas for all AutoCount tables organized by page
        </p>
      </div>

      {Object.entries(tablesToExplore).map(([sectionName, tableNames]) => (
        <Card key={sectionName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{sectionName}</CardTitle>
                <CardDescription className="text-xs">
                  {tableNames.length} table{tableNames.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSection(sectionName)}
              >
                {expandedSections[sectionName] ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </CardHeader>
          {expandedSections[sectionName] && (
            <CardContent className="space-y-4">
              {tableNames.map((tableName) => {
                const schema = schemas[tableName]
                const isLoading = loading[tableName]
                const hasError = error[tableName]

                return (
                  <Card key={tableName} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tableName}</CardTitle>
                        {!schema && !isLoading && !hasError && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchSchema(tableName)}
                          >
                            Load Schema
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoading && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Loading schema...
                        </div>
                      )}
                      {hasError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                          {hasError}
                        </div>
                      )}
                      {schema && schema.columns.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead className="bg-gray-50">
                              <tr className="border-b">
                                <th className="text-left p-2 font-semibold">Column Name</th>
                                <th className="text-left p-2 font-semibold">Data Type</th>
                                <th className="text-left p-2 font-semibold">Max Length</th>
                                <th className="text-left p-2 font-semibold">Nullable</th>
                                <th className="text-left p-2 font-semibold">Required</th>
                                <th className="text-left p-2 font-semibold">Auto Increment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.columns.map((col, idx) => (
                                <tr key={col.COLUMN_NAME} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                  <td className="p-2 font-medium">{col.COLUMN_NAME}</td>
                                  <td className="p-2">
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                      {col.DATA_TYPE}
                                    </span>
                                  </td>
                                  <td className="p-2 text-muted-foreground">
                                    {col.CHARACTER_MAXIMUM_LENGTH !== null
                                      ? col.CHARACTER_MAXIMUM_LENGTH
                                      : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="p-2">
                                    {col.IS_NULLABLE === 'YES' ? (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                                        No
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {col.IS_NULLABLE === 'NO' ? (
                                      <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                                        Required
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">Optional</span>
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {col.IS_IDENTITY === 1 ? (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">No</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-xs text-muted-foreground mt-2">
                            {schema.columns.length} column{schema.columns.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                      {schema && schema.columns.length === 0 && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No columns found
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}

