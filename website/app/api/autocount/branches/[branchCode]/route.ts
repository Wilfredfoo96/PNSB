import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db'

/**
 * GET /api/autocount/branches/[branchCode]
 * Returns a single branch by code
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { branchCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const branchCode = decodeURIComponent(params.branchCode)

    const query = `
      SELECT 
        AutoKey, AccNo, BranchCode, BranchName, Address1, Address2, Address3, Address4,
        PostCode, Contact, Phone1, Phone2, Fax1, Fax2, AreaCode,
        SalesAgent, PurchaseAgent, EmailAddress, IsActive, Mobile, TaxEntityID
      FROM Branch
      WHERE BranchCode = @BranchCode
    `

    const branches = await executeQuery(query, { BranchCode: branchCode }, true)

    if (branches.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: branches[0] })
  } catch (error) {
    console.error('Error fetching branch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch branch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/autocount/branches/[branchCode]
 * Updates a branch
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { branchCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const branchCode = decodeURIComponent(params.branchCode)
    const body = await request.json()

    const {
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

    // Check if branch exists
    const checkQuery = 'SELECT AutoKey FROM Branch WHERE BranchCode = @BranchCode'
    const existing = await executeQuery<{ AutoKey: number }>(checkQuery, { BranchCode: branchCode }, true)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Update branch
    const updateQuery = `
      UPDATE Branch SET
        BranchName = @BranchName,
        Address1 = @Address1,
        Address2 = @Address2,
        Address3 = @Address3,
        Address4 = @Address4,
        PostCode = @PostCode,
        Contact = @Contact,
        Phone1 = @Phone1,
        Phone2 = @Phone2,
        Fax1 = @Fax1,
        Fax2 = @Fax2,
        AreaCode = @AreaCode,
        SalesAgent = @SalesAgent,
        PurchaseAgent = @PurchaseAgent,
        EmailAddress = @EmailAddress,
        IsActive = @IsActive,
        Mobile = @Mobile,
        TaxEntityID = @TaxEntityID,
        LastUpdate = 0
      WHERE BranchCode = @BranchCode
    `

    const queryParams = {
      BranchCode: branchCode,
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

    await executeQuery(updateQuery, queryParams, true)

    // Fetch updated branch
    const fetchQuery = `
      SELECT 
        AutoKey, AccNo, BranchCode, BranchName, Address1, Address2, Address3, Address4,
        PostCode, Contact, Phone1, Phone2, Fax1, Fax2, AreaCode,
        SalesAgent, PurchaseAgent, EmailAddress, IsActive, Mobile, TaxEntityID
      FROM Branch
      WHERE BranchCode = @BranchCode
    `
    const updatedBranch = await executeQuery(fetchQuery, { BranchCode: branchCode }, true)

    return NextResponse.json({
      success: true,
      message: 'Branch updated successfully',
      data: updatedBranch[0],
    })
  } catch (error) {
    console.error('Error updating branch:', error)
    return NextResponse.json(
      { error: 'Failed to update branch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autocount/branches/[branchCode]
 * Deletes a branch
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { branchCode: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const branchCode = decodeURIComponent(params.branchCode)

    // Check if branch exists
    const checkQuery = 'SELECT AutoKey FROM Branch WHERE BranchCode = @BranchCode'
    const existing = await executeQuery<{ AutoKey: number }>(checkQuery, { BranchCode: branchCode }, true)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Delete branch
    const deleteQuery = 'DELETE FROM Branch WHERE BranchCode = @BranchCode'
    await executeQuery(deleteQuery, { BranchCode: branchCode }, true)

    return NextResponse.json({
      success: true,
      message: 'Branch deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json(
      { error: 'Failed to delete branch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
