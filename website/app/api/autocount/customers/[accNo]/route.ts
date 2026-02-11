import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/customers/[accNo]
 * Returns single customer with all details
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { accNo: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accNo = decodeURIComponent(params.accNo)

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getDebtor(accNo)

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch customer',
          message: response.message,
        },
        { status: response.error?.includes('not found') ? 404 : 500 }
      )
    }

    const debtor = response.data
    if (!debtor) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Transform to match existing API format
    // Note: Some fields may not be available from the API
    return NextResponse.json({
      data: {
        AccNo: debtor.accNo,
        CompanyName: debtor.name || null,
        Desc2: null, // Not available from API
        RegisterNo: debtor.registerNo || null,
        DebtorType: debtor.debtorType || null,
        TinNo: debtor.taxRegNo || null,
        Address1: debtor.address1 || null,
        Address2: debtor.address2 || null,
        Address3: debtor.address3 || null,
        Address4: debtor.address4 || null,
        PostCode: null, // Not available from API
        Attention: debtor.contact || null,
        Phone1: debtor.phone1 || null,
        Phone2: null, // Not available from API
        Mobile: null, // Not available from API
        Fax1: null, // Not available from API
        Fax2: null, // Not available from API
        EmailAddress: debtor.email || null,
        CreditLimit: debtor.creditLimit || null,
        DisplayTerm: debtor.terms || null,
        CurrencyCode: debtor.currencyCode || null,
        TaxCode: debtor.taxCode || null,
        SalesAgent: debtor.salesAgent || null,
        // Preserve the actual isActive value from API, don't default to 'Y'
        IsActive: debtor.isActive || null,
        LastModified: debtor.lastModified || null,
        // Note: currency and taxCode details not available from API
        // These would need separate API endpoints if needed
      },
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    
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
        error: 'Failed to fetch customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/autocount/customers/[accNo]
 * Updates an existing customer
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { accNo: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accNo = decodeURIComponent(params.accNo)
    const body = await request.json()

    // Map request body to API client format
    const updateRequest: {
      name?: string;
      address1?: string;
      address2?: string;
      address3?: string;
      address4?: string;
      contact?: string;
      phone1?: string;
      email?: string;
      debtorType?: string;
      terms?: string;
      salesAgent?: string;
      creditLimit?: number;
      taxCode?: string;
      taxRegNo?: string;
      isActive?: string;
    } = {}

    if (body.CompanyName !== undefined) updateRequest.name = body.CompanyName
    if (body.Address1 !== undefined) updateRequest.address1 = body.Address1
    if (body.Address2 !== undefined) updateRequest.address2 = body.Address2
    if (body.Address3 !== undefined) updateRequest.address3 = body.Address3
    if (body.Address4 !== undefined) updateRequest.address4 = body.Address4
    if (body.Attention !== undefined) updateRequest.contact = body.Attention
    if (body.Phone1 !== undefined) updateRequest.phone1 = body.Phone1
    if (body.EmailAddress !== undefined) updateRequest.email = body.EmailAddress
    if (body.DebtorType !== undefined) updateRequest.debtorType = body.DebtorType
    if (body.DisplayTerm !== undefined) updateRequest.terms = body.DisplayTerm
    if (body.SalesAgent !== undefined) updateRequest.salesAgent = body.SalesAgent
    if (body.CreditLimit !== undefined) updateRequest.creditLimit = body.CreditLimit
    if (body.TaxCode !== undefined) updateRequest.taxCode = body.TaxCode
    if (body.RegisterNo !== undefined) updateRequest.taxRegNo = body.RegisterNo
    if (body.IsActive !== undefined) updateRequest.isActive = body.IsActive

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.updateDebtor(accNo, updateRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('not found') ? 404 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to update customer',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    const debtor = response.data
    if (!debtor) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Transform to match existing API format
    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        AccNo: debtor.accNo,
        CompanyName: debtor.name,
        Address1: debtor.address1,
        Address2: debtor.address2,
        Address3: debtor.address3,
        Address4: debtor.address4,
        Attention: debtor.contact,
        Phone1: debtor.phone1,
        EmailAddress: debtor.email,
        DebtorType: debtor.debtorType,
        DisplayTerm: debtor.terms,
        SalesAgent: debtor.salesAgent,
        CreditLimit: debtor.creditLimit,
        TaxCode: debtor.taxCode,
        RegisterNo: debtor.taxRegNo,
        // Preserve the actual isActive value from API
        IsActive: debtor.isActive || null,
      },
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    
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
        error: 'Failed to update customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autocount/customers/[accNo]
 * Deletes a customer (soft deletes by setting IsActive = 'N')
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { accNo: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accNo = decodeURIComponent(params.accNo)

    // Use IIS API client (soft delete)
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.deleteDebtor(accNo)

    if (!response.success) {
      const statusCode = response.error?.includes('not found') ? 404 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to delete customer',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    
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
        error: 'Failed to delete customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

