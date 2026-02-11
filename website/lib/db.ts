import sql from 'mssql'

// Connection pool - reused across requests
let pool: sql.ConnectionPool | null = null

// Removed getDbConfig function - now using connection string directly in getDbPool

/**
 * Get or create a connection pool to the AutoCount database
 * Connection pools are reused across requests for better performance
 * 
 * NOTE: For debugging endpoints (like database explorer), direct database access is allowed
 * even in production if database credentials are configured. For regular operations,
 * use the IIS API (AUTOCOUNT_API_BASE_URL) instead.
 * 
 * @param allowDirectAccess - If true, bypasses production check (for debugging only)
 */
export async function getDbPool(allowDirectAccess: boolean = false): Promise<sql.ConnectionPool> {
  // Check if we're in a cloud environment (Vercel, etc.)
  const apiBaseUrl = process.env.AUTOCOUNT_API_BASE_URL
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined
  const isProduction = process.env.NODE_ENV === 'production'
  
  // In production/Vercel, if API is configured, disable direct DB access
  // UNLESS allowDirectAccess is true (for debugging endpoints)
  if (!allowDirectAccess && (isVercel || isProduction) && apiBaseUrl && !apiBaseUrl.includes('localhost')) {
    throw new Error(
      'Direct database access is disabled in production. ' +
      'Please use the IIS API (AUTOCOUNT_API_BASE_URL) instead. ' +
      'All database operations should go through the AutoCount IIS API endpoints. ' +
      'For debugging, use the database explorer which has direct access enabled.'
    )
  }

  if (pool && pool.connected) {
    console.log('[DB] Using existing connection pool')
    return pool
  }

  const serverConfig = process.env.AUTOCOUNT_DB_SERVER
  const database = process.env.AUTOCOUNT_DB_NAME
  const user = process.env.AUTOCOUNT_DB_USER
  const password = process.env.AUTOCOUNT_DB_PASSWORD
  const encrypt = process.env.AUTOCOUNT_DB_ENCRYPT === 'true'
  const port = process.env.AUTOCOUNT_DB_PORT // Optional: specify port directly

  // Log configuration (without sensitive data)
  console.log('[DB] Connection attempt started', {
    server: serverConfig,
    database,
    user,
    port: port || 'default',
    encrypt,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })

  if (!serverConfig || !database || !user || !password) {
    const missing = []
    if (!serverConfig) missing.push('AUTOCOUNT_DB_SERVER')
    if (!database) missing.push('AUTOCOUNT_DB_NAME')
    if (!user) missing.push('AUTOCOUNT_DB_USER')
    if (!password) missing.push('AUTOCOUNT_DB_PASSWORD')
    
    console.error('[DB] Missing required configuration:', { missing })
    throw new Error(
      `Missing required database configuration: ${missing.join(', ')}. ` +
      `Please set all required environment variables, or use the IIS API (AUTOCOUNT_API_BASE_URL) instead.`
    )
  }

  try {
    // Parse the server config to extract instance name and handle port
    let server: string
    let portNumber: number | undefined

    // Check if port is specified in environment variable
    if (port) {
      portNumber = parseInt(port, 10)
      if (isNaN(portNumber)) {
        throw new Error('AUTOCOUNT_DB_PORT must be a valid number')
      }
    }

    // Detect Cloudflare Tunnel URLs (domain names, not hostname\instance)
    const isCloudflareTunnel = 
      serverConfig.includes('.trycloudflare.com') ||
      serverConfig.includes('.cfargotunnel.com') ||
      (!serverConfig.includes('\\') && !serverConfig.includes(',') && serverConfig.includes('.'))

    if (isCloudflareTunnel) {
      // Cloudflare Tunnel: use domain name directly, no instance parsing
      server = serverConfig
      // Default to port 1433 for Cloudflare Tunnel if not specified
      if (!portNumber) {
        portNumber = 1433
      }
    } else if (serverConfig.includes('\\')) {
      // Named instance format (HOSTNAME\INSTANCE)
      const parts = serverConfig.split('\\')
      const hostname = parts[0].toLowerCase()
      const instanceName = parts[1]
      
      // Check if port is included in hostname (format: hostname,port)
      if (hostname.includes(',')) {
        const [host, portStr] = hostname.split(',')
        portNumber = parseInt(portStr, 10)
        if (!isNaN(portNumber)) {
          server = `${host}\\${instanceName}`
        } else {
          server = serverConfig
        }
      } else {
        // For local connections, use localhost instead of hostname
        // This can help avoid SQL Server Browser discovery issues
        if (hostname.startsWith('desktop-') || 
            hostname.startsWith('laptop-') ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '(local)') {
          server = `localhost\\${instanceName}`
        } else {
          server = serverConfig // Keep original format for remote connections
        }
      }
    } else {
      // If no instance specified, try localhost for local connections
      const hostname = serverConfig.toLowerCase()
      if (hostname.includes(',')) {
        const [host, portStr] = hostname.split(',')
        portNumber = parseInt(portStr, 10)
        if (!isNaN(portNumber)) {
          server = host
        } else {
          server = serverConfig
        }
      } else if (hostname.startsWith('desktop-') || hostname.startsWith('laptop-')) {
        server = 'localhost'
      } else {
        server = serverConfig
      }
    }

    // Build connection configuration
    // For Cloudflare Tunnel and named instances with port, use connection string format
    // For standard connections, use config object
    
    let connectionConfig: sql.config | string

    if (isCloudflareTunnel) {
      // Cloudflare Tunnel: use connection string format with explicit port
      // For Cloudflare tunnels, always trust server certificate to avoid SSL issues
      connectionConfig = `Server=${server},${portNumber};Database=${database};User Id=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=true;Connection Timeout=30000;Request Timeout=30000;`
      
      console.log('[DB] Using Cloudflare Tunnel connection', {
        server,
        port: portNumber,
        database,
        encrypt,
        connectionString: `Server=${server},${portNumber};Database=${database};User Id=${user};Password=***;Encrypt=${encrypt};TrustServerCertificate=true;Connection Timeout=30000;Request Timeout=30000;`,
      })
    } else if (portNumber && server.includes('\\')) {
      // For named instances with explicit port, use connection string format
      // This matches the sqlcmd format: localhost\A2006,1433
      const parts = server.split('\\')
      const hostname = parts[0]
      const instance = parts[1]
      // Connection string format that works with mssql
      connectionConfig = `Server=${hostname}\\${instance},${portNumber};Database=${database};User Id=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=${!encrypt};Connection Timeout=30000;Request Timeout=30000;`
    } else {
      // Use config object for standard connections
      connectionConfig = {
        server,
        database,
        user,
        password,
        port: portNumber,
        options: {
          encrypt,
          trustServerCertificate: !encrypt,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      }
    }

    const config = connectionConfig

    console.log('[DB] Creating connection pool...', {
      configType: typeof config === 'string' ? 'connection string' : 'config object',
      server: typeof config === 'string' ? server : (config as sql.config).server,
      port: typeof config === 'string' ? portNumber : (config as sql.config).port,
    })

    const startTime = Date.now()
    
    // ConnectionPool can accept either config object or connection string
    if (typeof config === 'string') {
      pool = new sql.ConnectionPool(config)
    } else {
      pool = new sql.ConnectionPool(config)
    }
    
    console.log('[DB] Attempting connection...', {
      server,
      port: portNumber,
      database,
      timeout: '30s',
    })
    
    await pool.connect()
    
    const connectionTime = Date.now() - startTime
    console.log('[DB] Connection successful!', {
      connectionTime: `${connectionTime}ms`,
      server,
      database,
      connected: pool.connected,
    })
    
    return pool
  } catch (error) {
    pool = null
    
    // Extract detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorCode = (error as any)?.code
    const errorNumber = (error as any)?.number
    const errorState = (error as any)?.state
    const errorClass = (error as any)?.class
    const errorServerName = (error as any)?.serverName
    
    // Determine connection type
    const isTunnel = serverConfig?.includes('.trycloudflare.com') || 
                     serverConfig?.includes('.cfargotunnel.com') ||
                     (!serverConfig?.includes('\\') && serverConfig?.includes('.'))
    
    // Log detailed error information
    console.error('[DB] Connection failed - Detailed error information:', {
      errorMessage,
      errorCode,
      errorNumber,
      errorState,
      errorClass,
      errorServerName,
      server: serverConfig,
      port: port || 'default',
      database,
      user,
      encrypt,
      isTunnel,
      connectionType: isTunnel ? 'Cloudflare Tunnel' : 'Direct',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
    })
    
    if (errorStack) {
      console.error('[DB] Error stack trace:', errorStack)
    }
    
    // Additional diagnostic information
    const diagnostics: string[] = []
    
    if (isTunnel) {
      diagnostics.push('Cloudflare Tunnel connection failed.')
      diagnostics.push(`Target: ${serverConfig}:${port || 1433}`)
      diagnostics.push('Possible causes:')
      diagnostics.push('  1. Tunnel is not running (check: cloudflared tunnel run)')
      diagnostics.push('  2. DNS resolution failed (check: nslookup sql.pnsbmy.com)')
      diagnostics.push('  3. Tunnel not routing TCP correctly (may need Access TCP)')
      diagnostics.push('  4. Firewall blocking tunnel traffic')
      diagnostics.push('  5. SQL Server not accessible on localhost:1433')
      diagnostics.push('  6. Access TCP policy blocking connection')
    } else {
      diagnostics.push('Direct SQL Server connection failed.')
      diagnostics.push(`Target: ${serverConfig}`)
      diagnostics.push('Possible causes:')
      diagnostics.push('  1. SQL Server Browser service not running')
      diagnostics.push('  2. Server name format incorrect (HOSTNAME\\INSTANCE)')
      diagnostics.push('  3. SQL Server not allowing remote connections')
      diagnostics.push('  4. Firewall blocking port 1433')
      diagnostics.push('  5. Invalid credentials')
    }
    
    // Build comprehensive error message
    const detailedError = [
      `Failed to connect to AutoCount database`,
      ``,
      `Error: ${errorMessage}`,
      errorCode ? `Code: ${errorCode}` : '',
      errorNumber ? `SQL Error Number: ${errorNumber}` : '',
      errorState ? `SQL State: ${errorState}` : '',
      ``,
      `Connection Details:`,
      `  Server: ${serverConfig}`,
      `  Port: ${port || 'default (1433)'}`,
      `  Database: ${database}`,
      `  User: ${user}`,
      `  Encrypt: ${encrypt}`,
      `  Connection Type: ${isTunnel ? 'Cloudflare Tunnel' : 'Direct'}`,
      ``,
      ...diagnostics,
      ``,
      `Full error details logged to console.`,
    ].filter(Boolean).join('\n')
    
    console.error('[DB] Full error details:', detailedError)
    
    throw new Error(detailedError)
  }
}

/**
 * Execute a parameterized query safely
 * This ensures no SQL injection by using parameterized queries only
 * 
 * @param allowDirectAccess - If true, allows direct DB access even in production (for debugging)
 */
export async function executeQuery<T = any>(
  query: string,
  params?: Record<string, any>,
  allowDirectAccess: boolean = false
): Promise<T[]> {
  const pool = await getDbPool(allowDirectAccess)
  const request = pool.request()

  // Add parameters if provided
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }

  const result = await request.query(query)
  return result.recordset as T[]
}

/**
 * Close the database connection pool
 * Useful for cleanup or testing
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.close()
    pool = null
  }
}

