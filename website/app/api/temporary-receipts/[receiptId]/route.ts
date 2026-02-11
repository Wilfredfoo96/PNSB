import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * GET /api/temporary-receipts/[receiptId]
 * Returns single temporary receipt with header and all line items
 * Uses Convex database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const receiptId = params.receiptId as Id<'temporaryReceipts'>

    // Call Convex query
    const receipt = await convex.query(api.temporaryReceipts.get, {
      receiptId,
    })

    if (!receipt) {
      return NextResponse.json(
        { error: 'Temporary receipt not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: receipt })
  } catch (error) {
    console.error('Error fetching temporary receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch temporary receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/temporary-receipts/[receiptId]
 * Updates an existing temporary receipt
 * Uses Convex database
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const receiptId = params.receiptId as Id<'temporaryReceipts'>
    const body = await request.json()
    const { header, lineItems = [] } = body

    const userID = userId || 'ADMIN'

    // Call Convex mutation
    await convex.mutation(api.temporaryReceipts.update, {
      receiptId,
      header: header
        ? {
            description: header.description,
            salesAgent: header.salesAgent,
            paymentDate: header.paymentDate, // Renamed from dueDate
            currencyCode: header.currencyCode,
            currencyRate: header.currencyRate,
            toTaxCurrencyRate: header.toTaxCurrencyRate,
            paymentMethod: header.paymentMethod,
            priceCharge: header.priceCharge,
            priceReceive: header.priceReceive,
            remark: header.remark,
          }
        : undefined,
      lineItems: lineItems.length > 0
        ? lineItems.map((item: any, index: number) => ({
            seq: item.seq || index + 1,
            accNo: item.accNo,
            toAccountRate: item.toAccountRate,
            description: item.Description,
            projNo: item.ProjNo,
            deptNo: item.DeptNo,
            taxCode: item.TaxCode,
            tax: item.Tax,
            localTax: item.LocalTax,
            amount: item.Amount,
            netAmount: item.NetAmount,
            localNetAmount: item.LocalNetAmount,
            taxableAmt: item.TaxableAmt,
            subTotal: item.SubTotal,
            localSubTotal: item.LocalSubTotal,
            taxRate: item.TaxRate,
          }))
        : undefined,
      lastModifiedUserID: userID,
    })

    // Fetch and return updated receipt
    const updated = await convex.query(api.temporaryReceipts.get, {
      receiptId,
    })

    return NextResponse.json({
      success: true,
      message: 'Temporary receipt updated successfully',
      data: updated,
    })
  } catch (error) {
    console.error('Error updating temporary receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to update temporary receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/temporary-receipts/[receiptId]
 * Deletes a temporary receipt
 * Uses Convex database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const receiptId = params.receiptId as Id<'temporaryReceipts'>

    // Call Convex mutation
    await convex.mutation(api.temporaryReceipts.remove, {
      receiptId,
    })

    return NextResponse.json({
      success: true,
      message: 'Temporary receipt deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting temporary receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete temporary receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

