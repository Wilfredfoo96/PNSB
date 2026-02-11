import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'
import { getTableInfo } from '@/lib/autocount-schema'

/**
 * GET /api/autocount/search-value
 * Efficiently search for a value across all tables
 * Returns list of table names that contain the value
 * 
 * Query parameters:
 * - value: the value to search for
 * - limit: max number of tables to check (optional, default: all)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const searchValue = searchParams.get('value')

    if (!searchValue || !searchValue.trim()) {
      return NextResponse.json(
        { error: 'Value parameter is required' },
        { status: 400 }
      )
    }

    // Get all tables
    const tablesQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME
    `
    const allTables = await executeQuery<{ TABLE_NAME: string }>(tablesQuery)

    const matchingTables: string[] = []
    const searchTerm = `%${searchValue.trim()}%`

    // Search all tables in parallel for better performance
    const searchPromises = allTables.map(async (table) => {
      try {
        const tableInfo = await getTableInfo(table.TABLE_NAME)
        if (!tableInfo) return null

        // Find searchable columns (Code, Name, Description, etc.)
        const searchableColumns = tableInfo.columns
          .filter(col => {
            const colName = col.COLUMN_NAME.toLowerCase()
            return (
              colName.includes('code') ||
              colName.includes('name') ||
              colName.includes('desc') ||
              colName.includes('no') ||
              colName.includes('id')
            ) && (
              col.DATA_TYPE.includes('char') ||
              col.DATA_TYPE.includes('text') ||
              col.DATA_TYPE.includes('varchar') ||
              col.DATA_TYPE.includes('nvarchar')
            )
          })
          .map(col => col.COLUMN_NAME)

        if (searchableColumns.length === 0) return null

        // Build search query for this table (optimized with TOP 1 to stop early)
        const searchConditions = searchableColumns.map((col, idx) => {
          return `${col} LIKE @search${idx}`
        })

        const params: Record<string, any> = {}
        searchableColumns.forEach((_, idx) => {
          params[`search${idx}`] = searchTerm
        })

        // Use TOP 1 to stop searching as soon as we find a match (much faster)
        const query = `
          SELECT TOP 1 1 as found
          FROM ${table.TABLE_NAME}
          WHERE ${searchConditions.join(' OR ')}
        `

        const result = await executeQuery(query, params)
        
        if (result && result.length > 0) {
          return table.TABLE_NAME
        }
      } catch (err) {
        // Silently skip tables that error (might not have searchable columns)
        return null
      }
      return null
    })

    // Wait for all searches to complete
    const results = await Promise.all(searchPromises)
    results.forEach(tableName => {
      if (tableName) {
        matchingTables.push(tableName)
      }
    })

    return NextResponse.json({
      tables: matchingTables,
      total: matchingTables.length,
      searched: allTables.length,
    })
  } catch (error) {
    console.error('Error in search-value API:', error)
    return NextResponse.json(
      { error: 'Failed to search value', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

