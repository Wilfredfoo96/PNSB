import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getNextDeliveryOrderNumber()

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to get next delivery order number',
          message: response.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: response.data,
    })
  } catch (error) {
    console.error('Error getting next delivery order number:', error)
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
        error: 'Failed to get next delivery order number',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

