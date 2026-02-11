# Setting Up Database Explorer with Cloudflare Tunnel

This guide explains how to configure the Database Explorer to work through a Cloudflare Tunnel.

## Overview

The Database Explorer uses direct SQL Server connections. To make it work through a Cloudflare Tunnel, you need to:

1. Add a TCP route for SQL Server (port 1433) to your **existing** tunnel configuration
2. Update your environment variables to point to the tunnel endpoint

**Important**: This script does NOT create a new tunnel. It only adds a database route to your existing tunnel configuration.

## Prerequisites

- **Cloudflare Tunnel already set up and working for the API** (required)
- Tunnel configuration file exists at `C:\cloudflared\config.yml`
- SQL Server is running on `localhost:1433` (or your configured port)

## Quick Setup

### Step 1: Add Database Route to Tunnel

Run the configuration script:

```powershell
cd C:\Project\PNSB\autocount-api\Installer
.\configure-db-tunnel.ps1
```

The script will:
- Read your existing tunnel configuration
- Add a TCP route for port 1433 (SQL Server)
- Prompt you for a hostname (or use trycloudflare.com for testing)

### Step 2: Restart the Tunnel

Stop your current tunnel (Ctrl+C if running in terminal) and restart it:

```powershell
cd C:\cloudflared
.\cloudflared.exe tunnel run autocount-api
```

If using trycloudflare.com, you'll see two URLs:
- One for HTTP (API): `https://abc123-def456.trycloudflare.com`
- One for TCP (Database): `tcp://abc123-def456.trycloudflare.com:1433`

### Step 3: Update Environment Variables

#### For Local Development (.env.local)

If using trycloudflare.com:
```env
AUTOCOUNT_DB_SERVER=abc123-def456.trycloudflare.com
AUTOCOUNT_DB_PORT=1433
AUTOCOUNT_DB_ENCRYPT=true
```

If using custom domain:
```env
AUTOCOUNT_DB_SERVER=sql.pnsbmy.com
AUTOCOUNT_DB_PORT=1433
AUTOCOUNT_DB_ENCRYPT=true
```

Keep your other database variables:
```env
AUTOCOUNT_DB_NAME=AED_PNSB
AUTOCOUNT_DB_USER=sa
AUTOCOUNT_DB_PASSWORD=AutoCount@123
```

#### For Production (Vercel)

Add these environment variables in Vercel dashboard:
- `AUTOCOUNT_DB_SERVER` = your tunnel hostname (without `tcp://`)
- `AUTOCOUNT_DB_PORT` = `1433`
- `AUTOCOUNT_DB_ENCRYPT` = `true`
- `AUTOCOUNT_DB_NAME` = `AED_PNSB`
- `AUTOCOUNT_DB_USER` = `sa`
- `AUTOCOUNT_DB_PASSWORD` = `AutoCount@123`

## Manual Configuration

If you prefer to edit the config file manually:

1. Open `C:\cloudflared\config.yml`

2. Add a database route to the `ingress` section:

```yaml
tunnel: <your-tunnel-id>
credentials-file: C:\Users\<username>\.cloudflared\<tunnel-id>.json

ingress:
  # API route (existing)
  - hostname: api.pnsbmy.com
    service: http://localhost:5001
  
  # Database route (new)
  - hostname: sql.pnsbmy.com
    service: tcp://localhost:1433
  
  # Catch-all (must be last)
  - service: http_status:404
```

Or for trycloudflare.com (no hostname):
```yaml
ingress:
  - service: http://localhost:5001
  - service: tcp://localhost:1433
  - service: http_status:404
```

3. Restart the tunnel

## Testing

1. Open your website's Database Explorer (`/dashboard/debugging/database-explorer`)
2. Try to load a table
3. If it works, you should see data from your AutoCount database

## Troubleshooting

### Connection Timeout

- Verify SQL Server is running: `Get-Service MSSQLSERVER` (or your instance name)
- Check SQL Server is listening on port 1433: `netstat -an | findstr 1433`
- Verify firewall allows connections on port 1433

### "Direct database access is disabled"

- Make sure `AUTOCOUNT_DB_SERVER` is set in your environment variables
- The Database Explorer should automatically enable direct access, but check the console logs

### Tunnel Not Starting

- Check tunnel logs: `.\cloudflared.exe tunnel run autocount-api --loglevel debug`
- Verify config file syntax (YAML is sensitive to indentation)
- Make sure the catch-all route (`http_status:404`) is last

### DNS Issues (Custom Domain)

- Verify DNS record points to Cloudflare
- Check Cloudflare dashboard for tunnel status
- Wait a few minutes for DNS propagation

## Notes

- **Security**: The tunnel encrypts traffic, but make sure your SQL Server credentials are secure
- **Performance**: Tunnel adds some latency. For production, consider using a dedicated database tunnel
- **Port**: Default SQL Server port is 1433. If using a different port, update the config accordingly

## Example Config File

Complete example with both API and database routes:

```yaml
tunnel: abc123-def456-789
credentials-file: C:\Users\YourName\.cloudflared\abc123-def456-789.json

ingress:
  # API endpoint
  - hostname: api.pnsbmy.com
    service: http://localhost:5001
  
  # Database endpoint
  - hostname: sql.pnsbmy.com
    service: tcp://localhost:1433
  
  # Catch-all (must be last)
  - service: http_status:404
```
