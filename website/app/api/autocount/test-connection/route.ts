import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDbPool, closeDbPool } from '@/lib/db'

/**
 * Test database connection endpoint
 * GET /api/autocount/test-connection
 * 
 * This endpoint provides detailed diagnostic information about the database connection
 */
export async function GET() {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      configuration: {
        server: process.env.AUTOCOUNT_DB_SERVER || 'NOT SET',
        database: process.env.AUTOCOUNT_DB_NAME || 'NOT SET',
        user: process.env.AUTOCOUNT_DB_USER || 'NOT SET',
        port: process.env.AUTOCOUNT_DB_PORT || 'NOT SET (default: 1433)',
        encrypt: process.env.AUTOCOUNT_DB_ENCRYPT || 'NOT SET',
      },
      tests: [] as any[],
    }

    // Test 1: Check environment variables
    const missingVars: string[] = []
    if (!process.env.AUTOCOUNT_DB_SERVER) missingVars.push('AUTOCOUNT_DB_SERVER')
    if (!process.env.AUTOCOUNT_DB_NAME) missingVars.push('AUTOCOUNT_DB_NAME')
    if (!process.env.AUTOCOUNT_DB_USER) missingVars.push('AUTOCOUNT_DB_USER')
    if (!process.env.AUTOCOUNT_DB_PASSWORD) missingVars.push('AUTOCOUNT_DB_PASSWORD')

    diagnostics.tests.push({
      name: 'Environment Variables',
      status: missingVars.length === 0 ? 'PASS' : 'FAIL',
      details: missingVars.length === 0 
        ? 'All required environment variables are set'
        : `Missing: ${missingVars.join(', ')}`,
    })

    // Test 2: Attempt DNS resolution (if server is a domain)
    const server = process.env.AUTOCOUNT_DB_SERVER
    if (server && server.includes('.')) {
      try {
        // Note: DNS resolution in Node.js requires dns module
        const dns = await import('dns/promises')
        const startTime = Date.now()
        const addresses = await dns.resolve4(server).catch(() => dns.resolve6(server))
        const dnsTime = Date.now() - startTime
        
        diagnostics.tests.push({
          name: 'DNS Resolution',
          status: 'PASS',
          details: `Resolved to: ${Array.isArray(addresses) ? addresses.join(', ') : addresses}`,
          timing: `${dnsTime}ms`,
        })
      } catch (dnsError: any) {
        diagnostics.tests.push({
          name: 'DNS Resolution',
          status: 'FAIL',
          details: `Failed to resolve: ${dnsError.message}`,
        })
      }
    }

    // Test 3: Attempt database connection
    const connectionStart = Date.now()
    try {
      const pool = await getDbPool()
      const connectionTime = Date.now() - connectionStart
      
      // Test a simple query
      const queryStart = Date.now()
      const result = await pool.request().query('SELECT @@VERSION as version, @@SERVERNAME as servername, DB_NAME() as database')
      const queryTime = Date.now() - queryStart
      
      diagnostics.tests.push({
        name: 'Database Connection',
        status: 'PASS',
        details: 'Successfully connected to database',
        timing: {
          connection: `${connectionTime}ms`,
          query: `${queryTime}ms`,
        },
        serverInfo: result.recordset[0] || {},
      })

      // Close the pool for this test
      await closeDbPool()
    } catch (connError: any) {
      const connectionTime = Date.now() - connectionStart
      
      diagnostics.tests.push({
        name: 'Database Connection',
        status: 'FAIL',
        details: connError.message,
        error: {
          message: connError.message,
          code: connError.code,
          number: connError.number,
          state: connError.state,
          class: connError.class,
          serverName: connError.serverName,
        },
        timing: `${connectionTime}ms`,
        stack: process.env.NODE_ENV === 'development' ? connError.stack : undefined,
      })
    }

    // Determine overall status
    const allPassed = diagnostics.tests.every((test: any) => test.status === 'PASS')
    diagnostics.overallStatus = allPassed ? 'SUCCESS' : 'FAILED'

    return NextResponse.json(diagnostics, {
      status: allPassed ? 200 : 500,
    })
  } catch (error: any) {
    console.error('[Test Connection] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Unexpected error during connection test',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

