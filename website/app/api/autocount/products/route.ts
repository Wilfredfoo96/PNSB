import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/products
 * Returns list of products with pagination, search, and filters
 * Query parameters: page, limit, search, category, brand, type
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 * Note: Category, brand, and type filters are not yet supported by IIS API
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
    // Note: category, brand, type filters not yet supported by IIS API

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getItems({
      page,
      pageSize,
      search: search || undefined,
      activeOnly: true, // Only active items by default
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

    // Transform response to match existing API format
    const data = response.data
    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Map IIS API response to frontend format
    const products = data.items.map((item: any) => ({
      AutoKey: 0, // Not available from API
      ItemCode: item.itemCode,
      Description: item.description || null,
      Desc2: item.desc2 || null,
      ItemGroup: item.itemGroup || null,
      ItemType: item.itemType || null,
      ItemCategory: item.itemCategory || null,
      ItemBrand: item.itemBrand || null,
      SalesUOM: item.uom || null,
      PurchaseUOM: item.uom || null, // Not available from API
      ReportUOM: item.uom || null, // Not available from API
      BaseUOM: item.uom || null, // Not available from API
      TaxCode: item.taxCode || null,
      StockControl: null, // Not available from API
      HasSerialNo: null, // Not available from API
      HasBatchNo: null, // Not available from API
      IsActive: item.isActive || 'Y',
      Discontinued: null, // Not available from API
      LastModified: null, // Not available from API
      LastModifiedUserID: null, // Not available from API
    }))

    return NextResponse.json({
      data: products,
      pagination: {
        page: data.page,
        limit: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
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

/**
 * POST /api/autocount/products
 * Creates a new product
 * Body: Product data object + UOMs array
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 * Note: UOMs array is not yet supported by IIS API
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { product, uoms = [] } = body

    // Validate required fields
    if (!product.ItemCode) {
      return NextResponse.json(
        { error: 'Missing required field: ItemCode' },
        { status: 400 }
      )
    }

    // Map request body to API client format
    const createRequest: any = {
      itemCode: product.ItemCode,
      description: product.Description || null,
      itemType: product.ItemType || null,
      itemCategory: product.ItemCategory || null,
      itemGroup: product.ItemGroup || null,
      salesUOM: product.SalesUOM || null,
      purchaseUOM: product.PurchaseUOM || product.SalesUOM || null,
      reportUOM: product.ReportUOM || product.SalesUOM || null,
      baseUOM: product.BaseUOM || product.SalesUOM || null,
      stockControl: product.StockControl || 'N',
      hasSerialNo: product.HasSerialNo || 'N',
      hasBatchNo: product.HasBatchNo || 'N',
      isActive: product.IsActive || 'Y',
      cost: product.Cost || null,
      price: product.Price || null,
      discountInfo: product.DiscountInfo || null,
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createItem(createRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('already exists') ? 409 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to create product',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    const item = response.data
    if (!item) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Transform to match existing API format
    return NextResponse.json(
      {
        success: true,
        message: 'Product created successfully',
        data: {
          ItemCode: item.itemCode,
          Description: item.description,
          Desc2: item.desc2,
          ItemType: item.itemType,
          ItemCategory: item.itemCategory,
          ItemBrand: item.itemBrand,
          ItemGroup: item.itemGroup,
          UOM: item.uom,
          Cost: item.cost,
          Price: item.price,
          IsActive: item.isActive || 'Y',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      {
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

