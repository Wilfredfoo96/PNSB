import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/settings/tax-codes
 * Returns list of tax codes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getTaxCodes()

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch tax codes',
          message: response.message,
        },
        { status: 500 }
      )
    }

    // Map IIS API response to frontend format
    const taxCodes = (response.data || []).map((tc: any) => {
      // Handle TaxRate - could be taxRate, TaxRate, or might need conversion
      let taxRate = tc.taxRate ?? tc.TaxRate ?? 0
      // Ensure it's a number
      if (typeof taxRate === 'string') {
        taxRate = parseFloat(taxRate) || 0
      }
      taxRate = Number(taxRate) || 0
      
      return {
        TaxCode: tc.taxCode || tc.TaxCode || '',
        Description: tc.description || tc.Description || null,
        TaxRate: taxRate,
        IsActive: tc.isActive || tc.IsActive || 'Y',
      }
    })
    
    console.log('[DEBUG] Tax codes mapped:', JSON.stringify(taxCodes, null, 2))

    return NextResponse.json({
      data: taxCodes,
    })
  } catch (error) {
    console.error('Error fetching tax codes:', error)
    
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
        error: 'Failed to fetch tax codes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/settings/tax-codes
 * Creates a new tax code
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createTaxCode({
      taxCode: body.TaxCode,
      description: body.Description,
      taxRate: body.TaxRate,
    })

    if (!response.success) {
      const statusCode = response.error?.includes('already exists') ? 409 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to create tax code',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Tax code created successfully',
        data: response.data,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating tax code:', error)
    
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
        error: 'Failed to create tax code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
