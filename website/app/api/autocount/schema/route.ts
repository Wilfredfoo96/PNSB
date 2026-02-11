import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTableInfo, getTableColumns, findTablesByPattern } from '@/lib/autocount-schema'

/**
 * GET /api/autocount/schema
 * Dynamically discover table schemas without hardcoding
 * Requires authentication via Clerk
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
    const pattern = searchParams.get('pattern')

    // If specific table requested
    if (tableName) {
      const tableInfo = await getTableInfo(tableName)
      if (!tableInfo) {
        return NextResponse.json(
          { error: `Table ${tableName} not found` },
          { status: 404 }
        )
      }
      return NextResponse.json({ data: tableInfo })
    }

    // If pattern search requested
    if (pattern) {
      const tables = await findTablesByPattern(pattern)
      return NextResponse.json({ data: tables })
    }

    // Return common AutoCount table mappings
    return NextResponse.json({
      data: {
        message: 'Use ?table=TableName to get schema, or ?pattern=Pattern to search tables',
        commonTables: {
          customers: 'Debtor',
          items: 'Item',
          salesOrders: 'SO',
          salesOrderDetails: 'SODTL',
          invoices: 'ARInvoice',
          invoiceDetails: 'ARInvoiceDTL',
          deliveryOrders: 'DO',
          deliveryOrderDetails: 'DODTL',
        },
      },
    })
  } catch (error) {
    console.error('Error fetching schema:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schema information' },
      { status: 500 }
    )
  }
}

