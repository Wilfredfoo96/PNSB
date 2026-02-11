/**
 * GET /api/autocount/invoices-v2
 * POST /api/autocount/invoices-v2
 * 
 * Refactored to use IIS API client instead of direct SQL
 * This is the new posting-safe implementation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
import { randomUUID } from 'crypto'

/**
 * GET /api/autocount/invoices-v2
 * Returns list of invoices with pagination and search
 * Note: List endpoint not yet available in IIS API, using direct SQL for now
 * Individual invoice retrieval uses API client
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
    const docKey = searchParams.get('docKey')
    const docNo = searchParams.get('docNo')

    // If specific invoice requested, use API client
    if (docKey) {
      const apiClient = getAutoCountApiClient()
      const response = await apiClient.getInvoice(parseInt(docKey))

      if (!response.success) {
        return NextResponse.json(
          {
            error: response.error || 'Failed to fetch invoice',
            message: response.message,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: response.data,
      })
    }

    if (docNo) {
      const apiClient = getAutoCountApiClient()
      const response = await apiClient.getInvoiceByDocNo(docNo)

      if (!response.success) {
        return NextResponse.json(
          {
            error: response.error || 'Failed to fetch invoice',
            message: response.message,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: response.data,
      })
    }

    // List endpoint - Now available in IIS API!
    const apiClient = getAutoCountApiClient()
    
    // Parse pagination and filter parameters
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || undefined
    const statusFilter = searchParams.get('status') || undefined
    
    const response = await apiClient.getInvoices({ page, pageSize, search, status: statusFilter })
    
    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch invoices',
          message: response.message,
        },
        { status: 500 }
      )
    }
    
    // Transform response to match existing API format for backward compatibility
    const paginatedData = response.data
    if (!paginatedData) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }
    
    // Map items to match existing format
    const mappedItems = paginatedData.items.map((invoice: any) => ({
      DocKey: invoice.docKey,
      DocNo: invoice.docNo,
      DocDate: invoice.docDate,
      DueDate: invoice.docDate, // Use DocDate as fallback if DueDate not available
      DebtorCode: invoice.debtorCode,
      DebtorName: invoice.debtorName,
      Total: invoice.total,
      LocalTotal: invoice.total, // Use Total as fallback
      Tax: invoice.tax,
      NetTotal: invoice.total, // Use Total as fallback
      PaymentAmt: 0, // Not available in list view
      LocalPaymentAmt: 0,
      Outstanding: invoice.total, // Use Total as fallback
      Cancelled: invoice.status === 'Void' ? 'T' : 'F',
      DocStatus: invoice.status === 'Draft' ? 'D' : invoice.status === 'Posted' ? 'P' : 'A',
      CurrencyCode: 'MYR', // Default, not available in list view
      LastModified: invoice.createdAt || new Date().toISOString(),
      LastModifiedUserID: 'API',
    }))
    
    return NextResponse.json({
      data: mappedItems,
      pagination: {
        page: paginatedData.page,
        limit: paginatedData.pageSize,
        total: paginatedData.total,
        totalPages: paginatedData.totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    
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
        error: 'Failed to fetch invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/invoices-v2
 * Creates a new draft invoice
 * Uses IIS API client (posting-safe)
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

    // Validate required fields
    if (!header?.DebtorCode || !header?.DocDate) {
      return NextResponse.json(
        { error: 'Missing required fields: DebtorCode, DocDate' },
        { status: 400 }
      )
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      )
    }

    // Map request to API client format
    // Note: DocNo is auto-generated by the API if not provided
    const createRequest = {
      idempotencyKey: randomUUID(), // Generate unique idempotency key
      debtorCode: header.DebtorCode,
      docDate: header.DocDate,
      ref: header.Ref || header.DocNo || undefined, // Optional - API will generate DocNo
      description: header.Description,
      remarks: header.Note,
      lines: lineItems.map((item: any) => {
        // Handle different field name variations from frontend
        const itemCode = item.ItemCode || item.AccNo
        if (!itemCode) {
          throw new Error('ItemCode or AccNo is required for each line item')
        }

        // Frontend sends Amount (total for line), but API needs Quantity and UnitPrice
        // If Quantity and UnitPrice are provided, use them
        // Otherwise, calculate from Amount (assume quantity = 1, unitPrice = Amount)
        let quantity = item.Qty || item.Quantity
        let unitPrice = item.UnitPrice || item.Rate
        
        // If we have Amount but no quantity/price, assume quantity 1 and unitPrice = Amount
        if ((!quantity || !unitPrice) && item.Amount) {
          quantity = quantity || 1
          unitPrice = unitPrice || item.Amount
        } else if (!quantity) {
          quantity = 1 // Default quantity
        } else if (!unitPrice) {
          // If we have quantity but no price, calculate from Amount
          unitPrice = item.Amount ? item.Amount / quantity : 0
        }

        // Ensure we have valid values
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

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createDraftInvoice(createRequest)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to create invoice',
          message: response.message,
        },
        { status: 500 }
      )
    }

    const invoice = response.data
    if (!invoice) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Transform response to match existing API format for backward compatibility
    return NextResponse.json(
      {
        success: true,
        message: 'Draft invoice created successfully',
        data: {
          DocKey: invoice.docKey,
          DocNo: invoice.docNo,
          DocDate: invoice.docDate,
          DueDate: invoice.docDate, // Use DocDate as fallback
          DebtorCode: invoice.debtorCode,
          DebtorName: invoice.debtorName,
          Status: invoice.status,
          DocStatus: invoice.status === 'Draft' ? 'D' : invoice.status === 'Posted' ? 'P' : 'A',
          Total: invoice.total,
          LocalTotal: invoice.total,
          Tax: invoice.tax,
          NetTotal: invoice.total,
          PaymentAmt: 0,
          LocalPaymentAmt: 0,
          Outstanding: invoice.total,
          Cancelled: 'F',
          CurrencyCode: 'MYR', // Default
          LastModified: invoice.createdAt || new Date().toISOString(),
          LastModifiedUserID: 'API',
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

