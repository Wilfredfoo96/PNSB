import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/find-tables
 * Search for tables by pattern to find correct table names
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const patterns = searchParams.get('patterns')?.split(',') || []

    if (patterns.length === 0) {
      return NextResponse.json({ error: 'Patterns parameter required' }, { status: 400 })
    }

    const results: Record<string, string[]> = {}

    for (const pattern of patterns) {
      const query = `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME LIKE @pattern
        ORDER BY TABLE_NAME
      `
      
      const tables = await executeQuery<{ TABLE_NAME: string }>(query, {
        pattern: `%${pattern}%`,
      })
      
      results[pattern] = tables.map(t => t.TABLE_NAME)
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error finding tables:', error)
    return NextResponse.json(
      { error: 'Failed to find tables', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

