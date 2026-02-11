/**
 * AutoCount Schema Discovery Utility
 * Dynamically discovers table structures instead of hardcoding them
 */

import { executeQuery } from './db'

// Re-export for convenience
export { executeQuery }

export interface TableColumn {
  COLUMN_NAME: string
  DATA_TYPE: string
  IS_NULLABLE: string
  CHARACTER_MAXIMUM_LENGTH: number | null
  IS_IDENTITY: number | null // 1 if identity column, 0 or null if not
}

export interface TableInfo {
  tableName: string
  schema: string
  columns: TableColumn[]
}

/**
 * Discover all columns for a given table
 */
export async function getTableColumns(
  tableName: string,
  schema: string = 'dbo'
): Promise<TableColumn[]> {
  // Use dynamic SQL to properly check identity columns
  // First get basic column info
  const baseQuery = `
    SELECT 
      COLUMN_NAME,
      DATA_TYPE,
      IS_NULLABLE,
      CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema
      AND TABLE_NAME = @tableName
    ORDER BY ORDINAL_POSITION
  `

  const columns = await executeQuery<Omit<TableColumn, 'IS_IDENTITY'>>(baseQuery, {
    schema,
    tableName,
  }, true) // Allow direct access for schema queries (used in debugging)

  // Get identity columns separately
  const identityQuery = `
    SELECT 
      c.name AS COLUMN_NAME
    FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = @schema
      AND t.name = @tableName
      AND c.is_identity = 1
  `

  const identityColumns = await executeQuery<{ COLUMN_NAME: string }>(identityQuery, {
    schema,
    tableName,
  }, true) // Allow direct access for schema queries (used in debugging)

  const identityColumnNames = new Set(identityColumns.map(col => col.COLUMN_NAME))

  // Combine results
  return columns.map(col => ({
    ...col,
    IS_IDENTITY: identityColumnNames.has(col.COLUMN_NAME) ? 1 : 0,
  }))
}

/**
 * Get table information including columns
 */
export async function getTableInfo(
  tableName: string,
  schema: string = 'dbo'
): Promise<TableInfo | null> {
  const columns = await getTableColumns(tableName, schema)
  if (columns.length === 0) {
    return null
  }

  return {
    tableName,
    schema,
    columns,
  }
}

/**
 * Find tables by pattern (e.g., '%Customer%', '%Item%')
 */
export async function findTablesByPattern(pattern: string): Promise<string[]> {
  const query = `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME LIKE @pattern
    ORDER BY TABLE_NAME
  `

  const results = await executeQuery<{ TABLE_NAME: string }>(query, {
    pattern: `%${pattern}%`,
  }, true) // Allow direct access for schema queries (used in debugging)

  return results.map((r) => r.TABLE_NAME)
}

/**
 * AutoCount table name mappings
 * These are the actual table names discovered from the database
 */
export const AutoCountTables = {
  // Customer tables
  Customer: 'Debtor',
  CustomerDetail: 'Debtor', // Same table, different context

  // Item/Product tables
  Item: 'Item',
  ItemDetail: 'Item',

  // Sales Order tables
  SalesOrder: 'SO',
  SalesOrderDetail: 'SODTL',

  // Invoice tables (AR = Accounts Receivable)
  SalesInvoice: 'ARInvoice',
  SalesInvoiceDetail: 'ARInvoiceDTL',

  // Delivery Order
  DeliveryOrder: 'DO',
  DeliveryOrderDetail: 'DODTL',

  // Quotation
  Quotation: 'QT',
  QuotationDetail: 'QTDTL',
} as const

/**
 * Get common column mappings for AutoCount tables
 * These are typical column names, but we can discover them dynamically
 */
export async function getCommonColumns(tableName: string): Promise<string[]> {
  const columns = await getTableColumns(tableName)
  return columns.map((col) => col.COLUMN_NAME)
}

/**
 * Build a SELECT query dynamically based on table structure
 */
export async function buildSelectQuery(
  tableName: string,
  options: {
    selectColumns?: string[]
    whereClause?: string
    orderBy?: string
    limit?: number
    offset?: number
  } = {}
): Promise<{ query: string; params: Record<string, any> }> {
  const { selectColumns, whereClause, orderBy, limit, offset } = options

  // Get all columns if not specified
  let columns: string[]
  if (selectColumns && selectColumns.length > 0) {
    columns = selectColumns
  } else {
    const tableInfo = await getTableInfo(tableName)
    if (!tableInfo) {
      throw new Error(`Table ${tableName} not found`)
    }
    columns = tableInfo.columns.map((col) => col.COLUMN_NAME)
  }

  let query = `SELECT ${columns.join(', ')} FROM ${tableName}`
  const params: Record<string, any> = {}

  if (whereClause) {
    query += ` WHERE ${whereClause}`
  }

  if (orderBy) {
    query += ` ORDER BY ${orderBy}`
  }

  if (limit) {
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`
    params.offset = offset || 0
    params.limit = limit
  }

  return { query, params }
}

