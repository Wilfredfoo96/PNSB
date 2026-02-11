import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/products/[itemCode]/uoms
 * Returns all UOMs for a product
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
      FROM ItemUOM
      WHERE ItemCode = @itemCode
      ORDER BY UOM
    `
    const uoms = await executeQuery(query, { itemCode })

    return NextResponse.json({ data: uoms })
  } catch (error) {
    console.error('Error fetching UOMs:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch UOMs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/products/[itemCode]/uoms
 * Creates a new UOM for a product
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

    if (!body.UOM || !body.Rate) {
      return NextResponse.json(
        { error: 'Missing required fields: UOM, Rate' },
        { status: 400 }
      )
    }

    // Check if UOM already exists for this item
    const existingQuery = `
      SELECT UOM FROM ItemUOM 
      WHERE ItemCode = @itemCode AND UOM = @UOM
    `
    const existing = await executeQuery(existingQuery, { itemCode, UOM: body.UOM })
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'UOM already exists for this product' },
        { status: 409 }
      )
    }

    const { randomUUID } = await import('crypto')
    const guid = randomUUID()
    const lastUpdate = Math.floor(Date.now() / 1000)

    const insertQuery = `
      INSERT INTO ItemUOM (
        ItemCode, UOM, Rate, Shelf, Price, Cost,
        RealCost, MostRecentlyCost, MinSalePrice, MaxSalePrice,
        MinPurchasePrice, MaxPurchasePrice, MinQty, MaxQty,
        NormalLevel, ReOLevel, ReOQty, FOCLevel, FOCQty,
        BonusPointQty, BonusPoint, Weight, WeightUOM, Volume, VolumeUOM,
        BarCode, LastUpdate, RedeemBonusPoint, CSGNQty,
        Price2, Price3, Price4, Price5, Price6,
        MarkupRatio, MarkdownRatio2, MarkdownRatio3, MarkdownRatio4,
        MarkdownRatio5, MarkdownRatio6, MarkdownRatioMinPrice, MarkdownRatioMaxPrice,
        AutoCalcPrice, AutoCalcPrice2, AutoCalcPrice3, AutoCalcPrice4,
        AutoCalcPrice5, AutoCalcPrice6, AutoCalcMinSalePrice, AutoCalcMaxSalePrice,
        Measurement, SGEInvoiceUnitCode, Guid
      )
      VALUES (
        @ItemCode, @UOM, @Rate, @Shelf, @Price, @Cost,
        @RealCost, @MostRecentlyCost, @MinSalePrice, @MaxSalePrice,
        @MinPurchasePrice, @MaxPurchasePrice, @MinQty, @MaxQty,
        @NormalLevel, @ReOLevel, @ReOQty, @FOCLevel, @FOCQty,
        @BonusPointQty, @BonusPoint, @Weight, @WeightUOM, @Volume, @VolumeUOM,
        @BarCode, @LastUpdate, @RedeemBonusPoint, @CSGNQty,
        @Price2, @Price3, @Price4, @Price5, @Price6,
        @MarkupRatio, @MarkdownRatio2, @MarkdownRatio3, @MarkdownRatio4,
        @MarkdownRatio5, @MarkdownRatio6, @MarkdownRatioMinPrice, @MarkdownRatioMaxPrice,
        @AutoCalcPrice, @AutoCalcPrice2, @AutoCalcPrice3, @AutoCalcPrice4,
        @AutoCalcPrice5, @AutoCalcPrice6, @AutoCalcMinSalePrice, @AutoCalcMaxSalePrice,
        @Measurement, @SGEInvoiceUnitCode, @Guid
      )
    `

    await executeQuery(insertQuery, {
      ItemCode: itemCode,
      UOM: body.UOM,
      Rate: body.Rate,
      Shelf: body.Shelf || null,
      Price: body.Price || null,
      Cost: body.Cost || null,
      RealCost: body.RealCost || null,
      MostRecentlyCost: body.MostRecentlyCost || null,
      MinSalePrice: body.MinSalePrice || null,
      MaxSalePrice: body.MaxSalePrice || null,
      MinPurchasePrice: body.MinPurchasePrice || null,
      MaxPurchasePrice: body.MaxPurchasePrice || null,
      MinQty: body.MinQty || null,
      MaxQty: body.MaxQty || null,
      NormalLevel: body.NormalLevel || null,
      ReOLevel: body.ReOLevel || null,
      ReOQty: body.ReOQty || null,
      FOCLevel: body.FOCLevel || null,
      FOCQty: body.FOCQty || null,
      BonusPointQty: body.BonusPointQty || null,
      BonusPoint: body.BonusPoint || null,
      Weight: body.Weight || null,
      WeightUOM: body.WeightUOM || null,
      Volume: body.Volume || null,
      VolumeUOM: body.VolumeUOM || null,
      BarCode: body.BarCode || null,
      LastUpdate: lastUpdate,
      RedeemBonusPoint: body.RedeemBonusPoint || null,
      CSGNQty: body.CSGNQty || null,
      Price2: body.Price2 || null,
      Price3: body.Price3 || null,
      Price4: body.Price4 || null,
      Price5: body.Price5 || null,
      Price6: body.Price6 || null,
      MarkupRatio: body.MarkupRatio || null,
      MarkdownRatio2: body.MarkdownRatio2 || null,
      MarkdownRatio3: body.MarkdownRatio3 || null,
      MarkdownRatio4: body.MarkdownRatio4 || null,
      MarkdownRatio5: body.MarkdownRatio5 || null,
      MarkdownRatio6: body.MarkdownRatio6 || null,
      MarkdownRatioMinPrice: body.MarkdownRatioMinPrice || null,
      MarkdownRatioMaxPrice: body.MarkdownRatioMaxPrice || null,
      AutoCalcPrice: body.AutoCalcPrice || 0,
      AutoCalcPrice2: body.AutoCalcPrice2 || 0,
      AutoCalcPrice3: body.AutoCalcPrice3 || 0,
      AutoCalcPrice4: body.AutoCalcPrice4 || 0,
      AutoCalcPrice5: body.AutoCalcPrice5 || 0,
      AutoCalcPrice6: body.AutoCalcPrice6 || 0,
      AutoCalcMinSalePrice: body.AutoCalcMinSalePrice || 0,
      AutoCalcMaxSalePrice: body.AutoCalcMaxSalePrice || 0,
      Measurement: body.Measurement || null,
      SGEInvoiceUnitCode: body.SGEInvoiceUnitCode || null,
      Guid: guid,
    })

    const created = await executeQuery(
      `SELECT * FROM ItemUOM WHERE ItemCode = @itemCode AND UOM = @UOM`,
      { itemCode, UOM: body.UOM }
    )

    return NextResponse.json(
      {
        success: true,
        message: 'UOM created successfully',
        data: created[0],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating UOM:', error)
    return NextResponse.json(
      {
        error: 'Failed to create UOM',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

