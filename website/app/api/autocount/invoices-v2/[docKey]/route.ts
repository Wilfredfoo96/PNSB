/**
 * GET /api/autocount/invoices-v2/[docKey]
 * PUT /api/autocount/invoices-v2/[docKey]
 * DELETE /api/autocount/invoices-v2/[docKey]
 * 
 * Get, update, or void an invoice
 * Uses IIS API client (posting-safe)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/invoices-v2/[docKey]
 * Get a specific invoice
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
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: response.data,
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
 * PUT /api/autocount/invoices-v2/[docKey]
 * Update a draft invoice
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
    const { header, lineItems } = body

    // Map request to API client format
    const updateRequest: any = {}

    if (header) {
      if (header.DocDate) updateRequest.docDate = header.DocDate
      if (header.Ref || header.DocNo) updateRequest.ref = header.Ref || header.DocNo
      if (header.Description) updateRequest.description = header.Description
      if (header.Note) updateRequest.remarks = header.Note
    }

    // Map line items if provided
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      updateRequest.lines = lineItems.map((item: any) => {
        const itemCode = item.ItemCode || item.AccNo
        if (!itemCode) {
          throw new Error('ItemCode or AccNo is required for each line item')
        }

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
      return NextResponse.json(
        {
          error: response.error || 'Failed to update invoice',
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

    // Transform response to match existing API format
    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      data: {
        DocKey: invoice.docKey,
        DocNo: invoice.docNo,
        DocDate: invoice.docDate,
        DueDate: invoice.docDate,
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
        CurrencyCode: 'MYR',
        LastModified: invoice.createdAt || new Date().toISOString(),
        LastModifiedUserID: 'API',
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

/**
 * DELETE /api/autocount/invoices-v2/[docKey]
 * Void an invoice (soft delete)
 */
export async function DELETE(
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

    // Use IIS API client to void the invoice
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.voidInvoice(docKey)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to void invoice',
          message: response.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
    })
  } catch (error) {
    console.error('Error voiding invoice:', error)
    
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
        error: 'Failed to void invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

