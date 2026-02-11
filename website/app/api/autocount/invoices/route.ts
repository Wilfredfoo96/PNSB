import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/invoices
 * 
 * DEPRECATED: This route is deprecated. Use /api/autocount/invoices-v2 instead.
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
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
    const pageSize = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    // Note: dateFrom and dateTo filters not yet supported by IIS API

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getInvoices({
      page,
      pageSize,
      search: search || undefined,
      status: status || undefined,
    })

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch invoices',
          message: response.message,
        },
        { status: 500 }
      )
    }

    // Transform response to match existing API format
    const data = response.data
    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Map IIS API response to frontend format
    const invoices = data.items.map((invoice: any) => ({
      DocKey: invoice.docKey,
      DocNo: invoice.docNo,
      DocDate: invoice.docDate,
      DueDate: invoice.docDate, // Use DocDate as fallback if DueDate not available
      DebtorCode: invoice.debtorCode,
      DebtorName: invoice.debtorName,
      Total: invoice.total,
      LocalTotal: invoice.total, // Not available from API
      Tax: invoice.tax,
      NetTotal: invoice.total, // Not available from API
      PaymentAmt: 0, // Not available from API
      LocalPaymentAmt: 0, // Not available from API
      Outstanding: invoice.total, // Not available from API
      Cancelled: invoice.status === 'Void' ? 'T' : 'F',
      DocStatus: invoice.status === 'Draft' ? 'D' : invoice.status === 'Posted' ? 'P' : 'A',
      CurrencyCode: 'MYR', // Not available from API
      LastModified: invoice.lastModified,
      LastModifiedUserID: null, // Not available from API
    }))

    return NextResponse.json({
      data: invoices,
      pagination: {
        page: data.page,
        limit: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    
    if (error instanceof Error && error.message.includes('configuration missing')) {
      return NextResponse.json(
        {
          error: 'AutoCount API not configured',
          message: 'Please configure AUTOCOUNT_API_BASE_URL and AUTOCOUNT_API_KEY',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/invoices
 * 
 * DEPRECATED: This route is deprecated. Use /api/autocount/invoices-v2 instead.
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
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

    // Map request body to API client format
    const createRequest = {
      docNo: header.DocNo,
      docDate: header.DocDate,
      debtorCode: header.DebtorCode,
      ref: header.Ref || header.DocNo,
      description: header.Description,
      remarks: header.Note,
      lines: lineItems.map((item: any) => {
        const itemCode = item.ItemCode || item.AccNo
        let quantity = item.Qty || item.Quantity
        let unitPrice = item.UnitPrice || item.Rate
        
        // Calculate from Amount if not provided
        if ((!quantity || !unitPrice) && item.Amount) {
          quantity = quantity || 1
          unitPrice = unitPrice || item.Amount
        } else if (!quantity) {
          quantity = 1
        } else if (!unitPrice) {
          unitPrice = item.Amount ? item.Amount / quantity : 0
        }

        if (!quantity || quantity <= 0) quantity = 1
        if (!unitPrice || unitPrice < 0) unitPrice = 0

        return {
          itemCode: itemCode,
          quantity: quantity,
          unitPrice: unitPrice,
          discount: item.Discount || item.DiscountPercent || 0,
          taxCode: item.TaxCode,
          description: item.Description,
        }
      }),
    }

    // Validate required fields
    if (!createRequest.docNo || !createRequest.docDate || !createRequest.debtorCode) {
      return NextResponse.json(
        { error: 'Missing required fields: DocNo, DocDate, DebtorCode' },
        { status: 400 }
      )
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createDraftInvoice(createRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('already exists') ? 409 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to create invoice',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    const invoice = response.data
    if (!invoice) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Transform to match existing API format
    return NextResponse.json(
      {
        success: true,
        message: 'Invoice created successfully',
        data: {
          DocKey: invoice.docKey,
          DocNo: invoice.docNo,
          DocDate: invoice.docDate,
          DebtorCode: invoice.debtorCode,
          DebtorName: invoice.debtorName,
          Status: invoice.status,
          Total: invoice.total,
          Tax: invoice.tax,
        },
        docKey: invoice.docKey,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating invoice:', error)
    
    if (error instanceof Error && error.message.includes('configuration missing')) {
      return NextResponse.json(
        {
          error: 'AutoCount API not configured',
          message: 'Please configure AUTOCOUNT_API_BASE_URL and AUTOCOUNT_API_KEY',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

