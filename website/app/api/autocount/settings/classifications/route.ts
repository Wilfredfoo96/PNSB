import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/settings/classifications
 * Returns list of classifications
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
    const response = await apiClient.getClassifications()

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch classifications',
          message: response.message,
        },
        { status: 500 }
      )
    }

    // Map IIS API response to frontend format
    const classifications = (response.data || []).map((c: any) => ({
      Code: c.code || c.Code,
      Description: c.description || c.Description || null,
    }))

    return NextResponse.json({
      data: classifications,
    })
  } catch (error) {
    console.error('Error fetching classifications:', error)
    
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
        error: 'Failed to fetch classifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/settings/classifications
 * Creates a new classification
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
    const response = await apiClient.createClassification({
      code: body.Code,
      description: body.Description,
    })

    if (!response.success) {
      const statusCode = response.error?.includes('already exists') ? 409 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to create classification',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Classification created successfully',
        data: response.data,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating classification:', error)
    
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
        error: 'Failed to create classification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
