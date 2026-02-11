/**
 * GET /api/autocount/invoices-v2/next-number
 * 
 * Get the next available invoice number
 * This is a helper endpoint for auto-filling invoice numbers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get list of invoices to find the highest number
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getInvoices({ page: 1, pageSize: 1 })

    if (!response.success) {
      // If we can't get invoices, generate a simple number
      const year = new Date().getFullYear()
      const month = String(new Date().getMonth() + 1).padStart(2, '0')
      return NextResponse.json({
        data: {
          nextNumber: `I-${year}${month}-000001`,
        },
      })
    }

    // Find the highest invoice number
    const invoices = response.data?.items || []
    let maxNumber = 0

    if (invoices.length > 0) {
      // Extract number from invoice numbers like "I-000001" or "INV-2026-0001"
      invoices.forEach((invoice: any) => {
        const docNo = invoice.docNo || ''
        // Try to extract numeric part
        const match = docNo.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1])
          if (num > maxNumber) {
            maxNumber = num
          }
        }
      })
    }

    // Generate next number
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const nextNum = String(maxNumber + 1).padStart(6, '0')
    const nextNumber = `I-${nextNum}`

    return NextResponse.json({
      data: {
        nextNumber,
      },
    })
  } catch (error) {
    console.error('Error getting next invoice number:', error)
    
    // Fallback: generate a simple number
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const nextNumber = `I-${year}${month}-000001`

    return NextResponse.json({
      data: {
        nextNumber,
      },
    })
  }
}

