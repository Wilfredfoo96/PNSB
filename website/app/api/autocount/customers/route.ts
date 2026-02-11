import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

/**
 * GET /api/autocount/customers
 * Returns list of customers with pagination and search
 * Query parameters: page, limit, search
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.getDebtors({
      page,
      pageSize,
      search: search || undefined,
    })

    if (!response.success) {
      console.error('API client error:', {
        error: response.error,
        message: response.message,
        timestamp: response.timestamp,
      })
      return NextResponse.json(
        {
          error: response.error || 'Failed to fetch customers',
          message: response.message,
        },
        { status: 500 }
      )
    }

    // Transform response to match existing API format
    const data = response.data
    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    // Map IIS API response to frontend format
    // Note: Some fields may not be available from the API
    const customers = data.items.map((debtor: any) => {
      // Debug: Log the raw isActive value from API
      if (!debtor.isActive || debtor.isActive !== 'Y') {
        console.log('[Customers API] Customer with non-Y isActive:', {
          accNo: debtor.accNo,
          name: debtor.name,
          isActive: debtor.isActive,
          rawDebtor: debtor
        })
      }
      return {
      AutoKey: 0, // Not available from API
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
      LastModifiedUserID: null, // Not available from API
      }
    })

    return NextResponse.json({
      data: customers,
      pagination: {
        page: data.page,
        limit: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    
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
        error: 'Failed to fetch customers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autocount/customers
 * Creates a new customer
 * Body: Customer data object
 * 
 * MIGRATED: Now uses IIS API instead of direct database access
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Map request body to API client format
    const createRequest = {
      accNo: body.AccNo,
      name: body.CompanyName || body.Name,
      address1: body.Address1,
      address2: body.Address2,
      address3: body.Address3,
      address4: body.Address4,
      contact: body.Attention,
      email: body.EmailAddress,
      debtorType: body.DebtorType,
      terms: body.DisplayTerm || 'C.O.D.', // Default to C.O.D. if not provided
      creditLimit: body.CreditLimit,
    }

    // Validate required fields
    if (!createRequest.accNo) {
      return NextResponse.json(
        { error: 'Missing required field: AccNo' },
        { status: 400 }
      )
    }

    // Use IIS API client
    const apiClient = getAutoCountApiClient()
    const response = await apiClient.createDebtor(createRequest)

    if (!response.success) {
      const statusCode = response.error?.includes('already exists') ? 409 : 500
      return NextResponse.json(
        {
          error: response.error || 'Failed to create customer',
          message: response.message,
        },
        { status: statusCode }
      )
    }

    // Transform response to match existing API format
    const customer = response.data
    if (!customer) {
      return NextResponse.json(
        { error: 'No data returned from API' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Customer created successfully',
        data: {
          AccNo: customer.accNo,
          CompanyName: customer.name,
          Address1: customer.address1,
          Address2: customer.address2,
          Address3: customer.address3,
          Address4: customer.address4,
          Attention: customer.contact,
          Phone1: customer.phone1,
          EmailAddress: customer.email,
          DebtorType: customer.debtorType,
          DisplayTerm: customer.terms,
          SalesAgent: customer.salesAgent,
          CreditLimit: customer.creditLimit,
          TaxCode: customer.taxCode,
          RegisterNo: customer.taxRegNo,
          IsActive: customer.isActive || 'Y',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating customer:', error)
    
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
        error: 'Failed to create customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

