/**
 * POST /api/autocount/invoices-v2/[docKey]/post
 * 
 * Posts a draft invoice
 * Uses IIS API client (posting-safe)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

export async function POST(
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
    const response = await apiClient.postInvoice(docKey)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to post invoice',
          message: response.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice posted successfully',
    })
  } catch (error) {
    console.error('Error posting invoice:', error)
    
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
        error: 'Failed to post invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

