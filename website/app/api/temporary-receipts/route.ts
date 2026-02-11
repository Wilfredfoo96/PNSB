import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * GET /api/temporary-receipts
 * Returns list of temporary receipts with pagination, search, and filters
 * Uses Convex database instead of AutoCount
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    // Get branchId from query params if provided
    const branchId = searchParams.get('branchId') || undefined

    // Call Convex query
    const result = await convex.query(api.temporaryReceipts.list, {
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      branchId: branchId as any,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching temporary receipts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch temporary receipts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/temporary-receipts
 * Creates a new temporary receipt with header and line items
 * Uses Convex database instead of AutoCount
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { header, lineItems = [] } = body

    if (!header || typeof header !== 'object') {
      return NextResponse.json(
        { error: 'Request body must include a header object' },
        { status: 400 }
      )
    }

    // Validate required header fields (paymentDate is the date field; was renamed from dueDate)
    const docDate = header.docDate ?? header.dueDate
    const paymentDate = header.paymentDate ?? header.dueDate ?? docDate
    const debtorCode = header.debtorCode

    if (!docDate || !debtorCode) {
      return NextResponse.json(
        { error: 'Missing required fields: docDate and debtorCode are required' },
        { status: 400 }
      )
    }
    if (!paymentDate) {
      return NextResponse.json(
        { error: 'Missing required field: paymentDate (or dueDate) is required' },
        { status: 400 }
      )
    }

    const userID = userId || 'ADMIN'

    // Only pass branchId if it's a non-empty string (valid Convex Id)
    const branchId = header.branchId && String(header.branchId).trim() ? header.branchId : undefined

    // Call Convex mutation
    const receiptId = await convex.mutation(api.temporaryReceipts.create, {
      header: {
        docNo: header.docNo || undefined, // Optional - will be auto-generated
        docDate,
        paymentDate,
        debtorCode,
        description: header.description ?? undefined,
        salesAgent: header.salesAgent ?? undefined,
        currencyCode: 'MYR', // Hardcoded
        currencyRate: 1, // Hardcoded
        toTaxCurrencyRate: 1, // Hardcoded
        createdByName: header.createdByName || userID, // Creator name
        paymentMethod: header.paymentMethod ?? undefined,
        priceCharge: header.priceCharge != null ? Number(header.priceCharge) : undefined,
        priceReceive: header.priceReceive != null ? Number(header.priceReceive) : undefined,
        remark: header.remark ?? undefined,
        inclusiveTax: header.inclusiveTax || 'N',
        roundingMethod: header.roundingMethod ?? 0,
        withholdingTaxVersion: header.withholdingTaxVersion ?? 0,
        withholdingTaxRoundingMethod: header.withholdingTaxRoundingMethod ?? 0,
        cancelled: header.cancelled || 'N',
        docStatus: header.docStatus || 'O',
        lastModifiedUserID: userID,
        createdUserID: userID,
        branchId,
      },
      lineItems: lineItems.map((item: any, index: number) => ({
        seq: item.seq || index + 1,
        accNo: item.accNo,
        toAccountRate: item.toAccountRate,
        description: item.Description,
        projNo: item.ProjNo,
        deptNo: item.DeptNo,
        taxCode: item.TaxCode,
        tax: item.Tax,
        localTax: item.LocalTax,
        amount: item.Amount,
        netAmount: item.NetAmount,
        localNetAmount: item.LocalNetAmount,
        taxableAmt: item.TaxableAmt,
        subTotal: item.SubTotal,
        localSubTotal: item.LocalSubTotal,
        taxRate: item.TaxRate,
      })),
    })

    // Fetch and return created receipt
    const created = await convex.query(api.temporaryReceipts.get, {
      receiptId,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Temporary receipt created successfully',
        data: created,
        receiptId,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const details = error instanceof Error ? (error as Error & { data?: unknown }).data : undefined
    console.error('Error creating temporary receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to create temporary receipt',
        details: message,
        ...(details !== undefined && { data: details }),
      },
      { status: 500 }
    )
  }
}

