import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'
import { getTableInfo } from '@/lib/autocount-schema'

/**
 * GET /api/autocount/dynamic
 * 
 * DEBUGGING ENDPOINT: Uses direct database access for database explorer
 * This endpoint is specifically for debugging and should only be used in the debugging section.
 * 
 * Query parameters:
 * - table: specific table name (required)
 * - page: pagination page (default: 1)
 * - limit: items per page (default: 50)
 * - search: search term (optional, searches across all columns)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tableName = searchParams.get('table')

    if (!tableName) {
      return NextResponse.json(
        { error: 'Table name is required. Use ?table=TableName' },
        { status: 400 }
      )
    }

    // Get pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    // Get table structure to build dynamic query
    const tableInfo = await getTableInfo(tableName)
    if (!tableInfo) {
      return NextResponse.json(
        { error: `Table ${tableName} not found` },
        { status: 404 }
      )
    }

    // Build SELECT query with all columns
    const columns = tableInfo.columns.map(col => col.COLUMN_NAME)
    let query = `SELECT ${columns.map(col => `[${col}]`).join(', ')} FROM [${tableName}]`

    // Add search condition if provided
    const params: Record<string, any> = {}
    if (search) {
      // Search across all string columns
      const stringColumns = tableInfo.columns
        .filter(col => 
          col.DATA_TYPE === 'varchar' || 
          col.DATA_TYPE === 'nvarchar' || 
          col.DATA_TYPE === 'char' || 
          col.DATA_TYPE === 'nchar' ||
          col.DATA_TYPE === 'text' ||
          col.DATA_TYPE === 'ntext'
        )
        .map(col => col.COLUMN_NAME)

      if (stringColumns.length > 0) {
        const searchConditions = stringColumns.map(col => {
          const paramName = `search_${col}`
          params[paramName] = `%${search}%`
          return `[${col}] LIKE @${paramName}`
        })
        query += ` WHERE (${searchConditions.join(' OR ')})`
      }
    }

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM [${tableName}]`
    if (search && Object.keys(params).length > 0) {
      const stringColumns = tableInfo.columns
        .filter(col => 
          col.DATA_TYPE === 'varchar' || 
          col.DATA_TYPE === 'nvarchar' || 
          col.DATA_TYPE === 'char' || 
          col.DATA_TYPE === 'nchar' ||
          col.DATA_TYPE === 'text' ||
          col.DATA_TYPE === 'ntext'
        )
        .map(col => col.COLUMN_NAME)

      if (stringColumns.length > 0) {
        const searchConditions = stringColumns.map(col => {
          const paramName = `search_${col}`
          return `[${col}] LIKE @${paramName}`
        })
        countQuery += ` WHERE (${searchConditions.join(' OR ')})`
      }
    }

    // Execute count query (allow direct access for debugging)
    const countResult = await executeQuery<{ total: number }>(countQuery, params, true)
    const total = countResult[0]?.total || 0

    // Add pagination
    query += ` ORDER BY (SELECT NULL) OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`
    params.offset = offset
    params.limit = limit

    // Execute data query (allow direct access for debugging)
    const data = await executeQuery(query, params, true)

    // Convert data to array of objects with proper column names
    const formattedData = data.map((row: any) => {
      const obj: Record<string, any> = {}
      columns.forEach(col => {
        obj[col] = row[col] !== undefined ? row[col] : null
      })
      return obj
    })

    return NextResponse.json({
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        table: tableName,
        columns: columns,
      },
    })
  } catch (error) {
    console.error('Error in dynamic API:', error)
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes('Direct database access is disabled')) {
      return NextResponse.json(
        { 
          error: 'Database connection not available',
          message: 'Direct database access is required for the database explorer. Please ensure database connection settings are configured.',
          details: error.message
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

