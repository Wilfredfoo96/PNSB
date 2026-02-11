import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/products/[itemCode]
 * Returns single product with all details
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { itemCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemCode = decodeURIComponent(params.itemCode)

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getItem(itemCode)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch product',
          message: response.message,
        },
        { status: response.error?.includes('not found') ? 404 : 500 }
      )
    }

    const item = response.data
    if (!item) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Transform to match existing API format
    // Note: UOMs, prices, category, brand, taxCode details not available from API
    // These would need separate API endpoints if needed
    return NextResponse.json({
      data: {
        ItemCode: item.itemCode,
        Description: item.description || null,
        Desc2: item.desc2 || null,
        ItemType: item.itemType || null,
        ItemCategory: item.itemCategory || null,
        ItemBrand: item.itemBrand || null,
        ItemGroup: item.itemGroup || null,
        UOM: item.uom || null,
        Cost: item.cost || null,
        Price: item.price || null,
        IsActive: item.isActive || 'Y',
        // Note: UOMs, prices, category, brand, taxCode not available from API
        uoms: [],
        prices: [],
        category: null,
        brand: null,
        taxCode: item.taxCode || null,
      },
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    
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
        error: 'Failed to fetch product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/autocount/products/[itemCode]
 * Updates an existing product
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { itemCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemCode = decodeURIComponent(params.itemCode)
    const body = await request.json()
    const { product } = body

    // Map request body to API client format
    const updateRequest: {
      description?: string;
      desc2?: string;
      itemType?: string;
      itemCategory?: string;
      itemBrand?: string;
      itemGroup?: string;
      uom?: string;
      cost?: number;
      price?: number;
      isActive?: string;
    } = {}

    if (product.Description !== undefined) updateRequest.description = product.Description
    if (product.Desc2 !== undefined) updateRequest.desc2 = product.Desc2
    if (product.ItemType !== undefined) updateRequest.itemType = product.ItemType
    if (product.ItemCategory !== undefined) updateRequest.itemCategory = product.ItemCategory
    if (product.ItemBrand !== undefined) updateRequest.itemBrand = product.ItemBrand
    if (product.ItemGroup !== undefined) updateRequest.itemGroup = product.ItemGroup
    if (product.UOM !== undefined) updateRequest.uom = product.UOM
    if (product.Cost !== undefined) updateRequest.cost = product.Cost
    if (product.Price !== undefined) updateRequest.price = product.Price
    if (product.IsActive !== undefined) updateRequest.isActive = product.IsActive

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.updateItem(itemCode, updateRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('not found') ? 404 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to update product',
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
    return NextResponse.json({
      success: true,
      message: 'Product updated successfully',
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
    })
  } catch (error) {
    console.error('Error updating product:', error)
    
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
        error: 'Failed to update product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autocount/products/[itemCode]
 * Deletes a product (soft deletes by setting IsActive = 'N')
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemCode = decodeURIComponent(params.itemCode)

    // Use IIS API client (soft delete)
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.deleteItem(itemCode)

    if (!response.success) {
      const statusCode = response.error?.includes('not found') ? 404 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to delete product',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    
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
        error: 'Failed to delete product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

