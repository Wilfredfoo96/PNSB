/**
 * GET /api/autocount/products-v2
 * 
 * Refactored to use IIS API client instead of direct SQL
 * This is the new posting-safe implementation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/products-v2
 * Returns list of products/items with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const brand = searchParams.get('brand') || undefined
    const type = searchParams.get('type') || undefined
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getItems({ 
      page, 
      pageSize, 
      search,
      activeOnly: activeOnly !== false // Default to true
    })

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch products',
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

    // Map items to match existing frontend format
    const mappedItems = paginatedData.items.map(item => ({
      AutoKey: null, // Not available in API
      ItemCode: item.itemCode,
      Description: item.description,
      Desc2: item.desc2,
      ItemGroup: item.itemGroup,
      ItemType: item.itemType,
      ItemCategory: item.itemCategory,
      ItemBrand: item.itemBrand,
      SalesUOM: item.uom,
      PurchaseUOM: item.uom,
      ReportUOM: item.uom,
      BaseUOM: item.uom,
      TaxCode: item.taxCode || null,
      StockControl: null, // Not available in API
      HasSerialNo: null, // Not available in API
      HasBatchNo: null, // Not available in API
      IsActive: item.isActive,
      Discontinued: item.isActive === 'N' ? 'Y' : 'N',
      LastModified: null, // Not available in API
      LastModifiedUserID: null, // Not available in API
      Cost: item.cost,
      Price: item.price,
      Classification: item.classification || null,
    }))

    // Filter by category, brand, type if provided (client-side filtering)
    let filteredItems = mappedItems
    if (category) {
      filteredItems = filteredItems.filter(item => item.ItemCategory === category)
    }
    if (brand) {
      filteredItems = filteredItems.filter(item => item.ItemBrand === brand)
    }
    if (type) {
      filteredItems = filteredItems.filter(item => item.ItemType === type)
    }

    return NextResponse.json({
      data: filteredItems,
      pagination: {
        page: paginatedData.page,
        limit: paginatedData.pageSize,
        total: paginatedData.total,
        totalPages: paginatedData.totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    
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
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

