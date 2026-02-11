'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole } from '@/lib/permissions'

interface Table {
  TABLE_NAME: string
  TABLE_SCHEMA: string
}

interface TableColumn {
  COLUMN_NAME: string
  DATA_TYPE: string
  IS_NULLABLE: string
  CHARACTER_MAXIMUM_LENGTH?: number | null
  IS_IDENTITY?: number | null
}

interface TableData {
  [key: string]: any
}

export default function DatabaseExplorerPage() {
  const userRole = useUserRole()
  const router = useRouter()
  const permissions = getPermissionsForRole(userRole)
  const [tables, setTables] = useState<Table[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([])
  const [tableData, setTableData] = useState<TableData[]>([])
  const [editingRow, setEditingRow] = useState<number | null>(null)

  // Check permissions
  useEffect(() => {
    if (userRole !== null && !permissions.canAccessDebugging) {
      router.push('/dashboard')
    }
  }, [userRole, permissions.canAccessDebugging, router])
  const [editedData, setEditedData] = useState<TableData>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSchema, setShowSchema] = useState(false)
  const [tableSearch, setTableSearch] = useState('')
  const [valueSearch, setValueSearch] = useState('')
  const [tablesWithValue, setTablesWithValue] = useState<Set<string>>(new Set())
  const [searchingValue, setSearchingValue] = useState(false)
  const [dataSearch, setDataSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)

  // Fetch all tables
  useEffect(() => {
    fetchTables()
  }, [])

  // Fetch table data when table is selected
  useEffect(() => {
    if (selectedTable) {
      fetchTableStructure(selectedTable)
      fetchTableData(selectedTable, 1)
    }
  }, [selectedTable])

  // Search for value across all tables (optimized with dedicated API endpoint)
  useEffect(() => {
    if (!valueSearch.trim()) {
      setTablesWithValue(new Set())
      setSearchingValue(false)
      return
    }

    const abortController = new AbortController()

    const searchValue = async () => {
      setSearchingValue(true)
      const searchTerm = valueSearch.trim()

      try {
        // Use dedicated API endpoint that searches efficiently on the backend
        const params = new URLSearchParams({
          value: searchTerm,
        })

        const response = await fetch(`/api/autocount/search-value?${params.toString()}`, {
          signal: abortController.signal,
        })

        if (response.ok && !abortController.signal.aborted) {
          const data = await response.json()
          setTablesWithValue(new Set(data.tables || []))
        }
      } catch (err) {
        // Silently handle aborted requests or errors
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error searching for value:', err)
          setTablesWithValue(new Set())
        }
      } finally {
        if (!abortController.signal.aborted) {
          setSearchingValue(false)
        }
      }
    }

    // Debounce the search
    const timeoutId = setTimeout(searchValue, 500)
    
    return () => {
      clearTimeout(timeoutId)
      abortController.abort() // Cancel ongoing request if user types again
    }
  }, [valueSearch])

  const fetchTables = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/autocount/tables')
      if (!response.ok) throw new Error('Failed to fetch tables')
      
      const result = await response.json()
      setTables(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables')
    } finally {
      setLoading(false)
    }
  }

  const fetchTableStructure = async (tableName: string) => {
    try {
      const response = await fetch(`/api/autocount/schema?table=${tableName}`)
      if (!response.ok) throw new Error('Failed to fetch table structure')
      
      const data = await response.json()
      setTableColumns(data.data?.columns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table structure')
    }
  }

  const fetchTableData = async (tableName: string, pageNum: number = 1) => {
    setLoading(true)
    setError(null)
    setEditingRow(null)
    try {
      const params = new URLSearchParams({
        table: tableName,
        page: pageNum.toString(),
        limit: limit.toString(),
      })
      if (dataSearch) {
        params.append('search', dataSearch)
      }

      const response = await fetch(`/api/autocount/dynamic?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch table data')
      
      const data = await response.json()
      setTableData(data.data || [])
      setTotal(data.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data')
    } finally {
      setLoading(false)
    }
  }

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName)
    setPage(1)
    setDataSearch('')
    setEditingRow(null)
  }

  const handleDataSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTable) {
      fetchTableData(selectedTable, 1)
    }
  }

  const handleEdit = (rowIndex: number) => {
    setEditingRow(rowIndex)
    setEditedData({ ...tableData[rowIndex] })
  }

  const handleCancelEdit = () => {
    setEditingRow(null)
    setEditedData({})
  }

  const handleSave = async (rowIndex: number) => {
    if (!selectedTable) return

    setSaving(true)
    setError(null)

    try {
      // Find primary key (first column or column with 'key' or 'id' in name)
      const primaryKeyColumn = tableColumns.find(col => 
        /key/i.test(col.COLUMN_NAME) || /id$/i.test(col.COLUMN_NAME)
      ) || tableColumns[0]

      if (!primaryKeyColumn) {
        throw new Error('Cannot determine primary key')
      }

      const primaryKey = primaryKeyColumn.COLUMN_NAME
      const primaryValue = tableData[rowIndex][primaryKey]

      const response = await fetch('/api/autocount/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          primaryKey,
          primaryValue,
          data: editedData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save changes')
      }

      // Refresh data
      await fetchTableData(selectedTable, page)
      setEditingRow(null)
      setEditedData({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (rowIndex: number) => {
    if (!selectedTable) return

    // Confirm deletion
    if (!confirm('Are you sure you want to delete this row? This action cannot be undone.')) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Find primary key (first column or column with 'key' or 'id' in name)
      const primaryKeyColumn = tableColumns.find(col => 
        /key/i.test(col.COLUMN_NAME) || /id$/i.test(col.COLUMN_NAME)
      ) || tableColumns[0]

      if (!primaryKeyColumn) {
        throw new Error('Cannot determine primary key')
      }

      const primaryKey = primaryKeyColumn.COLUMN_NAME
      const primaryValue = tableData[rowIndex][primaryKey]

      const params = new URLSearchParams({
        table: selectedTable,
        primaryKey,
        primaryValue: String(primaryValue),
      })

      const response = await fetch(`/api/autocount/data?${params.toString()}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete row')
      }

      // Refresh data
      await fetchTableData(selectedTable, page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (rowIndex: number) => {
    if (!selectedTable) return

    setSaving(true)
    setError(null)

    try {
      const rowData = { ...tableData[rowIndex] }
      
      // Find identity/primary key columns to exclude (auto-generated columns)
      // These are typically auto-increment or GUID columns
      const identityColumns = tableColumns
        .filter(col => {
          const name = col.COLUMN_NAME.toLowerCase()
          // Only exclude actual identity/primary key columns, not required fields
          // Exclude: DocKey, *Key (but not AccKey), *ID (but not AccNo, UserID fields, etc.)
          // DO NOT exclude: AccNo, LastModifiedUserID, CreatedUserID, etc.
          const isUserIDField = name.includes('userid') || name.includes('user_id') || name.includes('modifiedby') || name.includes('createdby')
          const isAccNo = name === 'accno' || name === 'displayterm'
          
          return (name === 'dockey' || 
                  (name.includes('key') && name !== 'acckey' && name !== 'displayterm') ||
                  (name.endsWith('id') && !isAccNo && !isUserIDField && name !== 'displayterm'))
        })
        .map(col => col.COLUMN_NAME)

      // Remove only identity/primary key columns (auto-generated)
      identityColumns.forEach(col => {
        delete rowData[col]
      })

      // Handle all required columns - ensure they have values
      const requiredColumns = tableColumns.filter(col => col.IS_NULLABLE === 'NO')
      const timestamp = Date.now().toString().slice(-6)
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

       requiredColumns.forEach(col => {
         // Skip identity columns (already removed)
         if (identityColumns.includes(col.COLUMN_NAME)) return
         
         const colName = col.COLUMN_NAME.toLowerCase()
         // Ensure column exists in rowData - initialize if missing
         if (!(col.COLUMN_NAME in rowData)) {
           rowData[col.COLUMN_NAME] = null
         }
         const currentValue = rowData[col.COLUMN_NAME]
         const dataType = col.DATA_TYPE?.toLowerCase() || ''
         const maxLength = col.CHARACTER_MAXIMUM_LENGTH

         // Reference fields that should NOT be modified (they reference other tables)
         const isReferenceField = 
           colName.includes('currency') || 
           colName.includes('taxcode') || 
           colName.includes('uom') ||
           colName.includes('terms') ||
           colName.includes('type') ||
           colName.includes('category') ||
           colName.includes('group') ||
           colName.includes('level') ||
           colName.includes('format') ||
           colName === 'currencycode'

         // If value exists and is not empty, process it
         if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
           // For code/identifier fields, make them unique
           // BUT skip reference fields (CurrencyCode, TaxCode, etc.) - keep original values
           if (typeof currentValue === 'string' && !isReferenceField) {
             // Only modify actual identifier fields (AccNo, ItemCode, etc.)
             if (colName === 'accno' || 
                 (colName.includes('code') && !colName.includes('currency') && !colName.includes('tax')) ||
                 (colName.includes('no') && colName !== 'displayterm')) {
               // Check max length before appending
               const suffix = `_${timestamp}`
               const newValue = `${currentValue}${suffix}`
               
               if (maxLength === null || maxLength === undefined || newValue.length <= maxLength) {
                 rowData[col.COLUMN_NAME] = newValue
               } else {
                 // If too long, try shorter suffix
                 const shortSuffix = `_${timestamp.slice(-3)}`
                 const shortValue = `${currentValue}${shortSuffix}`
                 if (maxLength === null || maxLength === undefined || shortValue.length <= maxLength) {
                   rowData[col.COLUMN_NAME] = shortValue
                 } else {
                   // If still too long, truncate original and add minimal suffix
                   const maxOrigLength = maxLength - 4 // Reserve space for suffix
                   const truncated = currentValue.substring(0, Math.max(0, maxOrigLength))
                   rowData[col.COLUMN_NAME] = `${truncated}_${timestamp.slice(-2)}`
                 }
               }
             }
             // Keep reference fields and other string values as-is
           }
           // Keep numeric and other values as-is
         } else {
          // Value is NULL or missing - replace with dummy data based on ACTUAL DATA TYPE
          // Check for user ID fields first (LastModifiedUserID, CreatedUserID, etc.)
          if (colName.includes('userid') || colName.includes('user_id') || colName.includes('modifiedby') || colName.includes('createdby')) {
            // User ID fields - use "ADMIN" for string types, or 1 for integer types
            if (dataType.includes('char') || dataType.includes('text') || dataType.includes('nvarchar') || dataType.includes('varchar') || dataType.includes('nchar')) {
              rowData[col.COLUMN_NAME] = 'ADMIN'
            } else if (dataType.includes('int') || dataType.includes('bigint') || dataType.includes('smallint') || dataType.includes('tinyint')) {
              rowData[col.COLUMN_NAME] = 1
            } else {
              rowData[col.COLUMN_NAME] = 'ADMIN'
            }
          } else if (dataType === 'bit') {
            // Boolean - default to 0
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('int') || dataType.includes('bigint') || dataType.includes('smallint') || dataType.includes('tinyint')) {
            // Integer types - default to 0
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('decimal') || dataType.includes('float') || dataType.includes('numeric') || dataType.includes('real') || dataType.includes('money') || dataType.includes('smallmoney')) {
            // Numeric/decimal types - default to 0
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('date') || dataType.includes('time') || dataType === 'datetime' || dataType === 'datetime2' || dataType === 'smalldatetime' || dataType === 'datetimeoffset') {
            // Date/time types - use current timestamp
            rowData[col.COLUMN_NAME] = now
          } else if (dataType.includes('char') || dataType.includes('text') || dataType.includes('nvarchar') || dataType.includes('varchar') || dataType.includes('nchar')) {
            // String types - use dummy data based on max length
            if (maxLength === 1) {
              rowData[col.COLUMN_NAME] = '0'
            } else if (maxLength && maxLength < 10) {
              rowData[col.COLUMN_NAME] = 'DUMMY'
            } else {
              rowData[col.COLUMN_NAME] = 'DUMMY'
            }
          } else if (dataType === 'uniqueidentifier' || dataType === 'guid') {
            // GUID - keep as null (might be auto-generated)
            rowData[col.COLUMN_NAME] = null
          } else {
            // Unknown type - default to empty string
            rowData[col.COLUMN_NAME] = ''
          }
        }
      })

      // Final pass: Replace ALL remaining NULL values with dummy data (including nullable columns)
      tableColumns.forEach(col => {
        // Skip identity columns
        if (identityColumns.includes(col.COLUMN_NAME)) return
        
        // Ensure column exists in rowData
        if (!(col.COLUMN_NAME in rowData)) {
          rowData[col.COLUMN_NAME] = null
        }
        
        // If still NULL, replace with dummy data
        if (rowData[col.COLUMN_NAME] === null || rowData[col.COLUMN_NAME] === undefined) {
          const colName = col.COLUMN_NAME.toLowerCase()
          const dataType = col.DATA_TYPE?.toLowerCase() || ''
          const maxLength = col.CHARACTER_MAXIMUM_LENGTH
          
          // Check for user ID fields
          if (colName.includes('userid') || colName.includes('user_id') || colName.includes('modifiedby') || colName.includes('createdby')) {
            if (dataType.includes('char') || dataType.includes('text') || dataType.includes('nvarchar') || dataType.includes('varchar') || dataType.includes('nchar')) {
              rowData[col.COLUMN_NAME] = 'ADMIN'
            } else if (dataType.includes('int') || dataType.includes('bigint') || dataType.includes('smallint') || dataType.includes('tinyint')) {
              rowData[col.COLUMN_NAME] = 1
            } else {
              rowData[col.COLUMN_NAME] = 'ADMIN'
            }
          } else if (dataType === 'bit') {
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('int') || dataType.includes('bigint') || dataType.includes('smallint') || dataType.includes('tinyint')) {
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('decimal') || dataType.includes('float') || dataType.includes('numeric') || dataType.includes('real') || dataType.includes('money') || dataType.includes('smallmoney')) {
            rowData[col.COLUMN_NAME] = 0
          } else if (dataType.includes('date') || dataType.includes('time') || dataType === 'datetime' || dataType === 'datetime2' || dataType === 'smalldatetime' || dataType === 'datetimeoffset') {
            rowData[col.COLUMN_NAME] = now
          } else if (dataType.includes('char') || dataType.includes('text') || dataType.includes('nvarchar') || dataType.includes('varchar') || dataType.includes('nchar')) {
            if (maxLength === 1) {
              rowData[col.COLUMN_NAME] = '0'
            } else if (maxLength && maxLength < 10) {
              rowData[col.COLUMN_NAME] = 'DUMMY'
            } else {
              rowData[col.COLUMN_NAME] = 'DUMMY'
            }
          } else if (dataType === 'uniqueidentifier' || dataType === 'guid') {
            // Keep GUID as null (might be auto-generated)
            rowData[col.COLUMN_NAME] = null
          } else {
            rowData[col.COLUMN_NAME] = ''
          }
        }
      })

      const response = await fetch('/api/autocount/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          data: rowData,
          excludeColumns: identityColumns,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Show helpful error message
        if (errorData.missingColumns) {
          throw new Error(
            `Missing required fields: ${errorData.missingColumns.join(', ')}. ` +
            `The system tried to auto-fill these fields, but some may need manual values. ` +
            `Please edit the row first to provide appropriate values, then duplicate.`
          )
        }
        throw new Error(errorData.error || errorData.details || 'Failed to duplicate row')
      }

      // Refresh data
      await fetchTableData(selectedTable, page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate row')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (column: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [column]: value,
    }))
  }

  const filteredTables = tables.filter(table => {
    // Filter by table name search
    const matchesName = table.TABLE_NAME.toLowerCase().includes(tableSearch.toLowerCase())
    
    // Filter by value search (if value search is active)
    if (valueSearch.trim()) {
      return matchesName && tablesWithValue.has(table.TABLE_NAME)
    }
    
    return matchesName
  })

  // Find primary key column
  const primaryKeyColumn = selectedTable
    ? tableColumns.find(col => /key/i.test(col.COLUMN_NAME) || /id$/i.test(col.COLUMN_NAME)) || tableColumns[0]
    : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Database Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Browse all AutoCount database tables dynamically
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Tables List Sidebar - Compact */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tables</CardTitle>
            <Input
              type="text"
              placeholder="Search tables..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="text-xs h-8 mt-2"
            />
            <Input
              type="text"
              placeholder="Search by value..."
              value={valueSearch}
              onChange={(e) => setValueSearch(e.target.value)}
              className="text-xs h-8 mt-2"
            />
            {searchingValue && (
              <p className="text-xs text-muted-foreground mt-1">Searching...</p>
            )}
            {valueSearch.trim() && !searchingValue && (
              <p className="text-xs text-muted-foreground mt-1">
                {tablesWithValue.size} table{tablesWithValue.size !== 1 ? 's' : ''} found
              </p>
            )}
          </CardHeader>
          <CardContent className="p-2">
            {loading && tables.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto">
                {filteredTables.map((table) => (
                  <button
                    key={table.TABLE_NAME}
                    onClick={() => handleTableSelect(table.TABLE_NAME)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      selectedTable === table.TABLE_NAME
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {table.TABLE_NAME}
                  </button>
                ))}
              </div>
            )}
            {tables.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {filteredTables.length} / {tables.length}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Table Data View */}
        <div className="lg:col-span-4 space-y-4">
          {selectedTable ? (
            <>
              {/* Table Info - Compact */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedTable}</CardTitle>
                      <CardDescription className="text-xs">
                        {tableColumns.length} columns • {total} rows
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={showSchema ? "default" : "outline"}
                        className="h-8"
                        onClick={() => setShowSchema(!showSchema)}
                      >
                        {showSchema ? 'Hide' : 'Show'} Schema
                      </Button>
                      <form onSubmit={handleDataSearch} className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Search..."
                          value={dataSearch}
                          onChange={(e) => setDataSearch(e.target.value)}
                          className="text-sm h-8 w-48"
                        />
                        <Button type="submit" size="sm" className="h-8">Search</Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Schema Viewer */}
              {showSchema && tableColumns.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Schema: {selectedTable}</CardTitle>
                    <CardDescription className="text-xs">
                      Column definitions and data types
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead className="bg-gray-50">
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold sticky left-0 bg-gray-50">Column Name</th>
                            <th className="text-left p-2 font-semibold">Data Type</th>
                            <th className="text-left p-2 font-semibold">Max Length</th>
                            <th className="text-left p-2 font-semibold">Nullable</th>
                            <th className="text-left p-2 font-semibold">Required</th>
                            <th className="text-left p-2 font-semibold">Auto Increment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableColumns.map((col, idx) => (
                            <tr key={col.COLUMN_NAME} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <td className="p-2 font-medium sticky left-0 bg-inherit">
                                {col.COLUMN_NAME}
                              </td>
                              <td className="p-2 text-muted-foreground">
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Table - Horizontally Scrollable */}
              <Card>
                <CardContent className="p-0">
                  {error && (
                    <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                      {error}
                    </div>
                  )}

                  {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading data...</div>
                  ) : tableData.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No data found.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead className="sticky top-0 bg-gray-50 z-10">
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold bg-gray-50 sticky left-0 z-20 min-w-[100px]">
                              Actions
                            </th>
                            {tableColumns.map((col) => (
                              <th
                                key={col.COLUMN_NAME}
                                className="text-left p-2 font-semibold bg-gray-50 whitespace-nowrap min-w-[120px]"
                              >
                                {col.COLUMN_NAME}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {/* Actions Column - Sticky */}
                              <td className="p-2 bg-white sticky left-0 z-10 border-r">
                                {editingRow === idx ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => handleSave(idx)}
                                      disabled={saving}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs"
                                      onClick={handleCancelEdit}
                                      disabled={saving}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => handleEdit(idx)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => handleDuplicate(idx)}
                                      disabled={saving}
                                    >
                                      Dup
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => handleDelete(idx)}
                                      disabled={saving}
                                    >
                                      Del
                                    </Button>
                                  </div>
                                )}
                              </td>
                              {/* Data Columns */}
                              {tableColumns.map((col) => (
                                <td key={col.COLUMN_NAME} className="p-2 whitespace-nowrap">
                                  {editingRow === idx ? (
                                    <Input
                                      type="text"
                                      value={editedData[col.COLUMN_NAME] ?? ''}
                                      onChange={(e) => handleFieldChange(col.COLUMN_NAME, e.target.value)}
                                      className="h-7 text-xs min-w-[100px]"
                                      placeholder={col.IS_NULLABLE === 'YES' ? 'NULL' : ''}
                                    />
                                  ) : (
                                    <div className="max-w-[200px] truncate" title={String(row[col.COLUMN_NAME] ?? 'NULL')}>
                                      {row[col.COLUMN_NAME] !== null && row[col.COLUMN_NAME] !== undefined
                                        ? String(row[col.COLUMN_NAME])
                                        : <span className="text-muted-foreground italic">NULL</span>}
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {Math.ceil(total / limit) > 1 && (
                    <div className="p-4 border-t flex items-center justify-between">
                      <Button
                        onClick={() => fetchTableData(selectedTable!, page - 1)}
                        disabled={page === 1}
                        variant="outline"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {page} of {Math.ceil(total / limit)} ({total} rows)
                      </span>
                      <Button
                        onClick={() => fetchTableData(selectedTable!, page + 1)}
                        disabled={page >= Math.ceil(total / limit)}
                        variant="outline"
                        size="sm"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Select a table from the left to view its data
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

