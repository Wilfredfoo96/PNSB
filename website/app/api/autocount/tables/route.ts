import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/tables
 * Returns all tables in the database
 * Requires authentication via Clerk
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all tables
    const query = `
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        (SELECT COUNT(*) 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME = t.TABLE_NAME 
           AND TABLE_SCHEMA = t.TABLE_SCHEMA) AS COLUMN_COUNT
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME
    `

    const tables = await executeQuery(query, undefined, true) // Allow direct access for debugging

    return NextResponse.json({
      data: tables,
      total: tables.length,
    })
  } catch (error) {
    console.error('Error fetching tables:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    )
  }
}

