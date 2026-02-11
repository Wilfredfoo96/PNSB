import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * PUT /api/autocount/data
 * Update a row in a table
 * Requires authentication via Clerk
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { table, primaryKey, primaryValue, data } = body

    if (!table || !primaryKey || primaryValue === undefined || !data) {
      return NextResponse.json(
        { error: 'Missing required parameters: table, primaryKey, primaryValue, data' },
        { status: 400 }
      )
    }

    // Build UPDATE query dynamically
    const setClauses: string[] = []
    const params: Record<string, any> = {
      primaryValue,
    }

    for (const [column, value] of Object.entries(data)) {
      // Skip the primary key column
      if (column === primaryKey) continue
      
      const paramName = `value_${column}`
      setClauses.push(`${column} = @${paramName}`)
      params[paramName] = value === '' ? null : value
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const query = `
      UPDATE ${table}
      SET ${setClauses.join(', ')}
      WHERE ${primaryKey} = @primaryValue
    `

    await executeQuery(query, params)

    return NextResponse.json({ success: true, message: 'Row updated successfully' })
  } catch (error) {
    console.error('Error updating row:', error)
    return NextResponse.json(
      { error: 'Failed to update row', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/data
 * Insert a new row in a table
 * Requires authentication via Clerk
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { table, data, excludeColumns } = body

    if (!table || !data) {
      return NextResponse.json(
        { error: 'Missing required parameters: table, data' },
        { status: 400 }
      )
    }

    // Get table structure to check required columns
    const { getTableInfo } = await import('@/lib/autocount-schema')
    const tableInfo = await getTableInfo(table)
    
    if (!tableInfo) {
      return NextResponse.json(
        { error: `Table ${table} not found` },
        { status: 404 }
      )
    }

    // Find required (NOT NULL) columns that don't have defaults
    const requiredColumns = tableInfo.columns
      .filter(col => col.IS_NULLABLE === 'NO')
      .map(col => col.COLUMN_NAME)

    // Find primary key or identity columns (usually auto-generated)
    const identityColumns = tableInfo.columns
      .filter(col => /key/i.test(col.COLUMN_NAME) || /id$/i.test(col.COLUMN_NAME))
      .map(col => col.COLUMN_NAME)

    // Build INSERT query - include all provided data
    // For required columns that are missing, we'll need to handle them
    const columnsToInsert: string[] = []
    const values: string[] = []
    const params: Record<string, any> = {}

    // Process each column in the data
    for (const [column, value] of Object.entries(data)) {
      // Skip if explicitly excluded (like primary keys)
      if (excludeColumns && excludeColumns.includes(column)) {
        continue
      }

      // Skip identity/primary key columns (they're usually auto-generated)
      if (identityColumns.includes(column)) {
        continue
      }

      // Include the column - convert empty strings to null for nullable columns
      const columnInfo = tableInfo.columns.find(c => c.COLUMN_NAME === column)
      const isNullable = columnInfo?.IS_NULLABLE === 'YES'
      
      columnsToInsert.push(column)
      values.push(`@${column}`)
      
      // Handle empty strings - convert to null only if column is nullable
      if (value === '' && isNullable) {
        params[column] = null
      } else if (value === '' && !isNullable) {
        // For required columns, keep empty string (will be handled by default or error)
        params[column] = ''
      } else {
        params[column] = value === null || value === undefined ? null : value
      }
    }

    // Check if any required columns are missing
    const missingRequired = requiredColumns.filter(
      reqCol => !columnsToInsert.includes(reqCol) && !identityColumns.includes(reqCol)
    )

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { 
          error: `Missing required columns: ${missingRequired.join(', ')}. Please provide values for these fields.`,
          missingColumns: missingRequired
        },
        { status: 400 }
      )
    }

    if (columnsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'No data to insert' },
        { status: 400 }
      )
    }

    const query = `
      INSERT INTO ${table} (${columnsToInsert.join(', ')})
      VALUES (${values.join(', ')})
    `

    await executeQuery(query, params)

    return NextResponse.json({ success: true, message: 'Row inserted successfully' })
  } catch (error) {
    console.error('Error inserting row:', error)
    return NextResponse.json(
      { error: 'Failed to insert row', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autocount/data
 * Delete a row from a table
 * Requires authentication via Clerk
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const primaryKey = searchParams.get('primaryKey')
    const primaryValue = searchParams.get('primaryValue')

    if (!table || !primaryKey || primaryValue === undefined || primaryValue === null) {
      return NextResponse.json(
        { error: 'Missing required parameters: table, primaryKey, primaryValue' },
        { status: 400 }
      )
    }

    // Build DELETE query
    const query = `
      DELETE FROM ${table}
      WHERE ${primaryKey} = @primaryValue
    `

    const params: Record<string, any> = {
      primaryValue,
    }

    await executeQuery(query, params)

    return NextResponse.json({ success: true, message: 'Row deleted successfully' })
  } catch (error) {
    console.error('Error deleting row:', error)
    return NextResponse.json(
      { error: 'Failed to delete row', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

