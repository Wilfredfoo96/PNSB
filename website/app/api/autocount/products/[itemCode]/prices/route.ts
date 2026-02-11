import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/products/[itemCode]/prices
 * Returns all price lists for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { itemCode: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemCode = decodeURIComponent(params.itemCode)

    const query = `
      SELECT *
      FROM ItemPrice
      WHERE ItemCode = @itemCode
      ORDER BY PriceCategory, AccNo
    `
    const prices = await executeQuery(query, { itemCode })

    return NextResponse.json({ data: prices })
  } catch (error) {
    console.error('Error fetching prices:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/products/[itemCode]/prices
 * Creates a new price entry for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { itemCode: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemCode = decodeURIComponent(params.itemCode)
    const body = await request.json()

    if (!body.UOM) {
      return NextResponse.json(
        { error: 'Missing required field: UOM' },
        { status: 400 }
      )
    }

    const { randomUUID } = await import('crypto')
    const guid = randomUUID()
    const lastUpdate = Math.floor(Date.now() / 1000)

    // Get next ItemPriceKey
    const keyQuery = `SELECT ISNULL(MAX(ItemPriceKey), 0) + 1 as NextKey FROM ItemPrice`
    const keyResult = await executeQuery<{ NextKey: number }>(keyQuery)
    const itemPriceKey = keyResult[0]?.NextKey || 1

    const insertQuery = `
      INSERT INTO ItemPrice (
        ItemPriceKey, ItemCode, UOM, PriceCategory, AccNo,
        SuppCustItemCode, Ref, UseFixedPrice, FixedPrice, FixedDetailDiscount,
        Qty1, Price1, DetailDiscount1, Qty2, Price2, DetailDiscount2,
        Qty3, Price3, DetailDiscount3, Qty4, Price4, DetailDiscount4,
        FOCLevel, FOCQty, BonusPointQty, BonusPoint, LastUpdate, Guid
      )
      VALUES (
        @ItemPriceKey, @ItemCode, @UOM, @PriceCategory, @AccNo,
        @SuppCustItemCode, @Ref, @UseFixedPrice, @FixedPrice, @FixedDetailDiscount,
        @Qty1, @Price1, @DetailDiscount1, @Qty2, @Price2, @DetailDiscount2,
        @Qty3, @Price3, @DetailDiscount3, @Qty4, @Price4, @DetailDiscount4,
        @FOCLevel, @FOCQty, @BonusPointQty, @BonusPoint, @LastUpdate, @Guid
      )
    `

    await executeQuery(insertQuery, {
      ItemPriceKey: itemPriceKey,
      ItemCode: itemCode,
      UOM: body.UOM,
      PriceCategory: body.PriceCategory || null,
      AccNo: body.AccNo || null,
      SuppCustItemCode: body.SuppCustItemCode || null,
      Ref: body.Ref || null,
      UseFixedPrice: body.UseFixedPrice || 'N',
      FixedPrice: body.FixedPrice || null,
      FixedDetailDiscount: body.FixedDetailDiscount || null,
      Qty1: body.Qty1 || null,
      Price1: body.Price1 || null,
      DetailDiscount1: body.DetailDiscount1 || null,
      Qty2: body.Qty2 || null,
      Price2: body.Price2 || null,
      DetailDiscount2: body.DetailDiscount2 || null,
      Qty3: body.Qty3 || null,
      Price3: body.Price3 || null,
      DetailDiscount3: body.DetailDiscount3 || null,
      Qty4: body.Qty4 || null,
      Price4: body.Price4 || null,
      DetailDiscount4: body.DetailDiscount4 || null,
      FOCLevel: body.FOCLevel || null,
      FOCQty: body.FOCQty || null,
      BonusPointQty: body.BonusPointQty || null,
      BonusPoint: body.BonusPoint || null,
      LastUpdate: lastUpdate,
      Guid: guid,
    })

    const created = await executeQuery(
      `SELECT * FROM ItemPrice WHERE ItemPriceKey = @ItemPriceKey`,
      { ItemPriceKey: itemPriceKey }
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Price entry created successfully',
        data: created[0],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating price:', error)
    return NextResponse.json(
      {
        error: 'Failed to create price entry',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

