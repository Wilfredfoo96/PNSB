import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/invoices/[docKey]
 * Returns single invoice with header and all line items
 * 
 * DEPRECATED: This route is deprecated. Use /api/autocount/invoices-v2/[docKey] instead.
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { docKey: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docKey = parseInt(params.docKey)
    if (isNaN(docKey)) {
      return NextResponse.json(
        { error: 'Invalid DocKey' },
        { status: 400 }
      )
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getInvoice(docKey)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch invoice',
          message: response.message,
        },
        { status: response.error?.includes('not found') ? 404 : 500 }
      )
    }

    const invoice = response.data
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Transform to match existing API format
    return NextResponse.json({
      data: {
        DocKey: invoice.docKey,
        DocNo: invoice.docNo,
        DocDate: invoice.docDate,
        DueDate: invoice.docDate, // Use DocDate as fallback
        DebtorCode: invoice.debtorCode,
        DebtorName: invoice.debtorName,
        Total: invoice.total,
        Tax: invoice.tax,
        Status: invoice.status,
        // Map line items if available
        lineItems: invoice.lines?.map((line: any, index: number) => ({
          DtlKey: line.dtlKey || index + 1,
          DocKey: invoice.docKey,
          Seq: index + 1,
          AccNo: line.itemCode,
          Description: line.description,
          TaxCode: line.taxCode || null,
          Tax: line.taxAmount || 0,
          Amount: line.lineTotal || (line.quantity * line.unitPrice),
          NetAmount: line.lineTotal || (line.quantity * line.unitPrice),
          SubTotal: line.lineTotal || (line.quantity * line.unitPrice),
        })) || [],
        // Note: customer and currency details not available from API
        customer: null,
        currency: null,
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
 * PUT /api/autocount/invoices/[docKey]
 * Updates an existing invoice
 * 
 * DEPRECATED: This route is deprecated. Use /api/autocount/invoices-v2/[docKey] instead.
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { docKey: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docKey = parseInt(params.docKey)
    if (isNaN(docKey)) {
      return NextResponse.json(
        { error: 'Invalid DocKey' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { header, lineItems = [] } = body

    // Map request body to API client format
    const updateRequest: {
      docDate?: string;
      ref?: string;
      description?: string;
      remarks?: string;
      lines?: Array<{
        itemCode: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        taxCode?: string;
        description?: string;
      }>;
    } = {}

    if (header?.DocDate) {
      updateRequest.docDate = typeof header.DocDate === 'string' 
        ? header.DocDate 
        : new Date(header.DocDate).toISOString().split('T')[0]
    }
    if (header?.Ref || header?.DocNo) {
      updateRequest.ref = header.Ref || header.DocNo
    }
    if (header?.Description) {
      updateRequest.description = header.Description
    }
    if (header?.Note) {
      updateRequest.remarks = header.Note
    }
    if (lineItems && lineItems.length > 0) {
      updateRequest.lines = lineItems.map((item: any) => {
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
      })
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.updateDraftInvoice(docKey, updateRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('not found') ? 404 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to update invoice',
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
    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
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
    })
  } catch (error) {
    console.error('Error updating invoice:', error)
    
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
        error: 'Failed to update invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

