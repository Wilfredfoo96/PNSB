import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/branches
 * Returns all branches
 * Requires authentication via Clerk
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = `
      SELECT 
        AutoKey,
        AccNo,
        BranchCode,
        BranchName,
        Address1,
        Address2,
        Address3,
        Address4,
        PostCode,
        Contact,
        Phone1,
        Phone2,
        Fax1,
        Fax2,
        AreaCode,
        SalesAgent,
        PurchaseAgent,
        EmailAddress,
        IsActive,
        Mobile,
        TaxEntityID
      FROM Branch
      ORDER BY BranchCode
    `

    const branches = await executeQuery(query, undefined, true) // Allow direct access for system management

    return NextResponse.json({
      data: branches,
      total: branches.length,
    })
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch branches', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/branches
 * Creates a new branch
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      AccNo,
      BranchCode,
      BranchName,
      Address1,
      Address2,
      Address3,
      Address4,
      PostCode,
      Contact,
      Phone1,
      Phone2,
      Fax1,
      Fax2,
      AreaCode,
      SalesAgent,
      PurchaseAgent,
      EmailAddress,
      IsActive,
      Mobile,
      TaxEntityID,
    } = body

    // Validate required fields
    if (!BranchCode || !AccNo) {
      return NextResponse.json(
        { error: 'BranchCode and AccNo are required' },
        { status: 400 }
      )
    }

    // Check if branch code already exists
    const checkQuery = 'SELECT COUNT(*) as count FROM Branch WHERE BranchCode = @BranchCode'
    const existing = await executeQuery<{ count: number }>(checkQuery, { BranchCode }, true)
    
    if (existing[0]?.count > 0) {
      return NextResponse.json(
        { error: `Branch with code '${BranchCode}' already exists` },
        { status: 409 }
      )
    }

    // Insert new branch
    const insertQuery = `
      INSERT INTO Branch (
        AccNo, BranchCode, BranchName, Address1, Address2, Address3, Address4,
        PostCode, Contact, Phone1, Phone2, Fax1, Fax2, AreaCode,
        SalesAgent, PurchaseAgent, EmailAddress, IsActive, Mobile, TaxEntityID, LastUpdate
      )
      VALUES (
        @AccNo, @BranchCode, @BranchName, @Address1, @Address2, @Address3, @Address4,
        @PostCode, @Contact, @Phone1, @Phone2, @Fax1, @Fax2, @AreaCode,
        @SalesAgent, @PurchaseAgent, @EmailAddress, @IsActive, @Mobile, @TaxEntityID, 0
      );
      SELECT SCOPE_IDENTITY() as AutoKey;
    `

    const params = {
      AccNo: AccNo || '',
      BranchCode,
      BranchName: BranchName || null,
      Address1: Address1 || null,
      Address2: Address2 || null,
      Address3: Address3 || null,
      Address4: Address4 || null,
      PostCode: PostCode || null,
      Contact: Contact || null,
      Phone1: Phone1 || null,
      Phone2: Phone2 || null,
      Fax1: Fax1 || null,
      Fax2: Fax2 || null,
      AreaCode: AreaCode || null,
      SalesAgent: SalesAgent || null,
      PurchaseAgent: PurchaseAgent || null,
      EmailAddress: EmailAddress || null,
      IsActive: IsActive || 'Y',
      Mobile: Mobile || null,
      TaxEntityID: TaxEntityID || null,
    }

    const result = await executeQuery<{ AutoKey: number }>(insertQuery, params, true)
    const autoKey = result[0]?.AutoKey

    // Fetch the created branch
    const fetchQuery = `
      SELECT 
        AutoKey, AccNo, BranchCode, BranchName, Address1, Address2, Address3, Address4,
        PostCode, Contact, Phone1, Phone2, Fax1, Fax2, AreaCode,
        SalesAgent, PurchaseAgent, EmailAddress, IsActive, Mobile, TaxEntityID
      FROM Branch
      WHERE AutoKey = @AutoKey
    `
    const newBranch = await executeQuery(fetchQuery, { AutoKey: autoKey }, true)

    return NextResponse.json(
      { success: true, message: 'Branch created successfully', data: newBranch[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating branch:', error)
    return NextResponse.json(
      { error: 'Failed to create branch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
