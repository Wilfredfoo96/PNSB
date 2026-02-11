/**
 * GET /api/autocount/delivery-orders-v2
 * POST /api/autocount/delivery-orders-v2
 * 
 * Refactored to use IIS API client instead of direct SQL
 * This is the new posting-safe implementation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
import { randomUUID } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * GET /api/autocount/delivery-orders-v2
 * Returns list of delivery orders with pagination, or specific delivery order by DocKey or DocNo
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const docKey = searchParams.get('docKey')
    const docNo = searchParams.get('docNo')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || undefined
    const statusFilter = searchParams.get('status') || undefined
    const branchId = searchParams.get('branchId') || undefined

    const apiClient = getAutoCountApiClient()

    // Get single delivery order by docKey
    if (docKey) {
      const response = await apiClient.getDeliveryOrder(parseInt(docKey))
      
      if (!response.success) {
        return NextResponse.json(
          {
            error: response.error || 'Failed to fetch delivery order',
            message: response.message,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: response.data,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    }

    // Get single delivery order by docNo
    if (docNo) {
      const response = await apiClient.getDeliveryOrderByDocNo(docNo)
      
      if (!response.success) {
        return NextResponse.json(
          {
            error: response.error || 'Failed to fetch delivery order',
            message: response.message,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: response.data,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    }

    // List delivery orders with pagination
    console.log('Fetching delivery orders with params:', { page, pageSize, search, status: statusFilter, branchId })
    const response = await apiClient.getDeliveryOrders({ page, pageSize, search, status: statusFilter })

    if (!response.success) {
      console.error('API client error:', {
        error: response.error,
        message: response.message,
        timestamp: response.timestamp,
        fullResponse: JSON.stringify(response, null, 2),
      })
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch delivery orders',
          message: response.message,
        },
        { status: 500 }
      )
    }

    const paginatedData = response.data
    if (!paginatedData) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    let filteredItems = paginatedData.items

    // Filter out voided orders (where Cancelled = 'T' or Status = 'Void')
    // This is a safety check in case the backend doesn't filter them
    filteredItems = filteredItems.filter((item: any) => {
      const cancelled = item.Cancelled || item.cancelled || 'N'
      const status = item.Status || item.status || ''
      // Exclude if cancelled is 'T' or status is 'Void'
      return cancelled !== 'T' && status.toUpperCase() !== 'VOID'
    })

    // Filter by branchId if provided
    if (branchId) {
      try {
        // Get all DocKeys for this branch from Convex
        const docKeys = await convex.query(api.deliveryOrderBranches.getDocKeysByBranch, {
          branchId: branchId as any,
        })
        
        // Create a Set for fast lookup
        const docKeySet = new Set(docKeys)
        
        // Filter items to only include those with matching DocKeys
        filteredItems = filteredItems.filter((item: any) => {
          const itemDocKey = item.DocKey || item.docKey
          return itemDocKey && docKeySet.has(itemDocKey)
        })
        
        // Recalculate pagination for filtered results
        const total = filteredItems.length
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        filteredItems = filteredItems.slice(startIndex, endIndex)
        
        return NextResponse.json({
          data: filteredItems,
          pagination: {
            page,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        })
      } catch (error) {
        console.error('Error filtering by branchId:', error)
        // If filtering fails, return all items (fallback)
      }
    }

    return NextResponse.json({
      data: filteredItems,
      pagination: {
        page: paginatedData.page,
        limit: paginatedData.pageSize,
        total: paginatedData.total,
        totalPages: paginatedData.totalPages,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error fetching delivery orders:', error)
    
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
        error: 'Failed to fetch delivery orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/delivery-orders-v2
 * Creates a new draft delivery order
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

    // Validate line items
    const invalidLines: string[] = []
    lineItems.forEach((item: any, index: number) => {
      if (!item.ItemCode || item.ItemCode.trim() === '') {
        invalidLines.push(`Line ${index + 1}: ItemCode is required`)
      }
      const quantity = item.Qty || item.Quantity || 0
      if (!quantity || quantity <= 0) {
        invalidLines.push(`Line ${index + 1}: Quantity must be greater than 0`)
      }
      const unitPrice = item.UnitPrice || item.Rate || 0
      if (!unitPrice || unitPrice <= 0) {
        invalidLines.push(`Line ${index + 1}: UnitPrice must be greater than 0`)
      }
    })

    if (invalidLines.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          message: invalidLines.join('; '),
          details: invalidLines
        },
        { status: 400 }
      )
    }

    // Map request to API client format
    const createRequest = {
      idempotencyKey: randomUUID(),
      debtorCode: header.DebtorCode.trim(),
      docDate: header.DocDate,
      ref: header.Ref && header.Ref.trim() !== '' ? header.Ref.trim() : null, // Use Ref from form, or null if empty (don't use DocNo)
      description: header.Description || '',
      remarks: header.Note || '',
      taxEntityName: header.TaxEntityName || null,
      branchPrefix: header.BranchPrefix || null, // Branch prefix for DO numbering
      salesAgent: header.SalesAgent || null, // Current user's name (truncated to 12 chars in backend)
      lines: lineItems.map((item: any) => ({
        itemCode: item.ItemCode.trim(),
        quantity: item.Qty || item.Quantity || 0,
        unitPrice: item.UnitPrice || item.Rate || 0,
        discount: item.Discount || item.DiscountPercent || 0,
        description: item.Description || '',
        taxCode: item.TaxCode || null,
      })),
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createDraftDeliveryOrder(createRequest)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to create delivery order',
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

    // Store branch mapping in Convex if branchId is provided
    if (header.BranchId) {
      try {
        await convex.mutation(api.deliveryOrderBranches.upsert, {
          docKey: deliveryOrder.docKey,
          docNo: deliveryOrder.docNo,
          branchId: header.BranchId as any,
        })
      } catch (error) {
        console.error('Failed to store branch mapping:', error)
        // Don't fail the request if mapping fails
      }
    }

    // Deduct stock for each line item when delivery order is created
    // All branches share the same (global) stock — always use stockKeeping
    try {
      const lines = lineItems
        .map((item: any) => ({
          itemCode: (item.ItemCode || '').trim(),
          quantity: item.Qty || item.Quantity || 0,
        }))
        .filter((l: { itemCode: string; quantity: number }) => l.itemCode && l.quantity > 0)

      if (lines.length > 0) {
        console.log('[DO Create] Deducting stock (global):', lines.length, 'lines')
        for (const line of lines) {
          await convex.mutation(api.stockKeeping.adjustStockAndLog, {
            itemCode: line.itemCode,
            quantityChange: -line.quantity,
            userId: userId || 'SYSTEM',
            movementType: 'DO_OUT',
            referenceType: 'DELIVERY_ORDER',
            referenceId: String(deliveryOrder.docKey),
            notes: undefined,
          })
        }
        console.log('[DO Create] Stock deduction completed')
      }
    } catch (error) {
      console.error('[DO Create] Failed to adjust stock:', error)
      // Don't fail the request if stock adjustment fails, but log it
    }

    // Transform response to match existing API format
    return NextResponse.json(
      {
        success: true,
        message: 'Draft delivery order created successfully',
        data: {
          DocKey: deliveryOrder.docKey,
          DocNo: deliveryOrder.docNo,
          DocDate: deliveryOrder.docDate,
          DebtorCode: deliveryOrder.debtorCode,
          DebtorName: deliveryOrder.debtorName,
          Status: deliveryOrder.status,
          Total: deliveryOrder.total,
        },
        docKey: deliveryOrder.docKey,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating delivery order:', error)
    
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
        error: 'Failed to create delivery order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

