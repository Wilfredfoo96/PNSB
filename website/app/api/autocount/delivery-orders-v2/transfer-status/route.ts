/**
 * GET /api/autocount/delivery-orders-v2/transfer-status?docKeys=1,2,3
 * Returns which Delivery Orders have been transferred (fully or partially) to Invoice.
 * Uses DODtl.TransferedQty (or ToQty in some schemas): when any line has quantity transferred to invoice > 0, the DO is considered transferred.
 * Requires direct DB access (AutoCount SQL Server). If DB is unavailable, returns 503.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDbPool } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const docKeysParam = searchParams.get('docKeys')
    if (!docKeysParam || docKeysParam.trim() === '') {
      return NextResponse.json(
        { error: 'Missing docKeys query parameter (e.g. ?docKeys=1,2,3)' },
        { status: 400 }
      )
    }

    const docKeys = docKeysParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
    if (docKeys.length === 0) {
      return NextResponse.json({ data: {} })
    }

    // Allow direct DB for this read-only query (transfer status is not available from IIS API)
    const pool = await getDbPool(true)
    const inList = docKeys.join(',')
    const result = await pool.request().query(`
      SELECT DISTINCT DocKey
      FROM DODtl
      WHERE DocKey IN (${inList})
        AND ISNULL(TransferedQty, 0) > 0
    `)

    const transferredSet = new Set(
      (result.recordset || []).map((r: { DocKey: number }) => r.DocKey)
    )
    const data: Record<string, boolean> = {}
    docKeys.forEach((docKey) => {
      data[String(docKey)] = transferredSet.has(docKey)
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Error fetching DO transfer status:', err)
    if (err instanceof Error && err.message.includes('Direct database access is disabled')) {
      return NextResponse.json(
        {
          error: 'Transfer status requires database access',
          message: 'Direct DB is disabled in this environment. Transfer status will not be shown.',
        },
        { status: 503 }
      )
    }
    if (err instanceof Error && err.message.includes('Missing required database')) {
      return NextResponse.json(
        {
          error: 'Database not configured',
          message: 'Transfer status requires AutoCount database configuration.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch transfer status',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
