import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(
  request: NextRequest,
  { params }: { params: { docKey: string } }
) {
  try {
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

    const apiClient = getAutoCountApiClient()
    console.log('Fetching delivery order with docKey:', docKey)
    const response = await apiClient.getDeliveryOrder(docKey)

    if (!response.success) {
      console.error('API client error for delivery order:', {
        docKey,
        error: response.error,
        message: response.message,
        timestamp: response.timestamp,
        fullResponse: JSON.stringify(response, null, 2),
      })
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch delivery order',
          message: response.message,
        },
        { status: 404 }
      )
    }

    const deliveryOrder = response.data
    if (!deliveryOrder) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Map to existing frontend format
    return NextResponse.json({
      data: {
        DocKey: deliveryOrder.docKey,
        DocNo: deliveryOrder.docNo,
        DocDate: deliveryOrder.docDate,
        DebtorCode: deliveryOrder.debtorCode,
        DebtorName: deliveryOrder.debtorName,
        Status: deliveryOrder.status,
        Total: deliveryOrder.total || 0,
        // Map line items if available
        lineItems: deliveryOrder.lines?.map((line, index) => ({
          DtlKey: line.dtlKey || 0,
          DocKey: deliveryOrder.docKey,
          Seq: index + 1, // Use 1-based sequence
          ItemCode: line.itemCode || '',
          Description: line.description || '',
          UOM: '', // UOM not available in API response
          Qty: line.quantity || 0,
          UnitPrice: line.unitPrice || 0,
          Discount: line.discount || 0,
          Amount: line.lineTotal || (line.quantity || 0) * (line.unitPrice || 0),
          NetAmount: line.lineTotal || (line.quantity || 0) * (line.unitPrice || 0),
          SubTotal: line.lineTotal || (line.quantity || 0) * (line.unitPrice || 0),
        })) || [],
        // Map other fields expected by frontend
        Description: null, // Description not available in API response
        CurrencyCode: 'MYR', // CurrencyCode not available in API response
        CurrencyRate: 1, // CurrencyRate not available in API response
        SalesAgent: null, // SalesAgent not available in API response
        PostToStock: 'N', // PostToStock not available in API response
        LocalTotal: deliveryOrder.total || 0,
        NetTotal: deliveryOrder.total || 0,
        Cancelled: deliveryOrder.status === 'Void' ? 'Y' : 'N', // Use 'Y'/'N' instead of 'T'/'F'
        DocStatus: deliveryOrder.status === 'Draft' ? 'D' : deliveryOrder.status === 'Posted' ? 'P' : 'A',
      },
    })
  } catch (error) {
    console.error('Error fetching delivery order:', error)
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
        error: 'Failed to fetch delivery order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { docKey: string } }
) {
  try {
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

    // Map request to API client format
    const updateRequest: {
      docDate?: string;
      ref?: string;
      description?: string;
      remarks?: string;
      lines?: Array<{
        itemCode: string;
        quantity: number;
        unitPrice: number;
        discount: number;
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
      updateRequest.lines = lineItems.map((item: any) => ({
        itemCode: item.ItemCode || item.AccNo,
        quantity: item.Qty || item.Quantity || 0,
        unitPrice: item.UnitPrice || item.Rate || 0,
        discount: item.Discount || item.DiscountPercent || 0,
        description: item.Description,
      }))
    }

    const apiClient = getAutoCountApiClient()
    const response = await apiClient.updateDraftDeliveryOrder(docKey, updateRequest)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to update delivery order',
          message: response.message,
        },
        { status: 500 }
      )
    }

    const deliveryOrder = response.data
    if (!deliveryOrder) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery order updated successfully',
      data: {
        DocKey: deliveryOrder.docKey,
        DocNo: deliveryOrder.docNo,
        DocDate: deliveryOrder.docDate,
        DebtorCode: deliveryOrder.debtorCode,
        DebtorName: deliveryOrder.debtorName,
        Status: deliveryOrder.status,
        Total: deliveryOrder.total,
      },
    })
  } catch (error) {
    console.error('Error updating delivery order:', error)
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
        error: 'Failed to update delivery order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { docKey: string } }
) {
  try {
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

    const apiClient = getAutoCountApiClient()
    
    // First, fetch the delivery order to get line items for stock restoration
    const getResponse = await apiClient.getDeliveryOrder(docKey)
    if (!getResponse.success || !getResponse.data) {
      return NextResponse.json(
        {
          error: 'Failed to fetch delivery order details',
          message: getResponse.message,
        },
        { status: 404 }
      )
    }

    const deliveryOrder = getResponse.data

    const response = await apiClient.voidDeliveryOrder(docKey)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to void delivery order',
          message: response.message,
        },
        { status: 500 }
      )
    }

    // Restore stock for each line item (add back what was deducted)
    // All branches share the same (global) stock — always use stockKeeping
    try {
      const lines = (deliveryOrder.lines || [])
        .map((line: { itemCode?: string; quantity?: number }) => ({
          itemCode: (line.itemCode || '').trim(),
          quantity: line.quantity || 0,
        }))
        .filter((l: { itemCode: string; quantity: number }) => l.itemCode && l.quantity > 0)

      if (lines.length > 0) {
        console.log('[DO Void] Restoring stock (global):', lines.length, 'lines')
        for (const line of lines) {
          await convex.mutation(api.stockKeeping.adjustStockAndLog, {
            itemCode: line.itemCode,
            quantityChange: line.quantity,
            userId: userId || 'SYSTEM',
            movementType: 'DO_VOID_IN',
            referenceType: 'DELIVERY_ORDER',
            referenceId: String(docKey),
            notes: undefined,
          })
        }
        console.log('[DO Void] Stock restoration completed')
      }
    } catch (error) {
      console.error('Failed to restore stock:', error)
      // Don't fail the request if stock restoration fails
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery order voided successfully',
    })
  } catch (error) {
    console.error('Error voiding delivery order:', error)
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
        error: 'Failed to void delivery order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

