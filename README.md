# AutoCount Integration Project - Complete Guide

## Overview

This project implements a **posting-safe integration** between AutoCount Accounting v2.2 (on-premise) and a cloud website/application. The solution ensures data integrity by routing all accounting transaction operations through AutoCount's logic, never performing direct SQL INSERT/DELETE operations on transactions.

## Architecture

```
Cloud Website (Next.js) → HTTPS REST API → IIS REST API (ASP.NET Core) → AutoCount Accounting Logic → SQL Server Database
```

## Quick Start

### 1. Prerequisites Check
```powershell
.\check-installer-prereqs.ps1
```

### 2. Build the API
```powershell
cd autocount-api\AutoCountApi
dotnet publish -c Release -o ./publish
cd ..\..
```

### 3. Install API
```powershell
.\setup.ps1 install-api
```

### 4. Setup Cloudflare Tunnel (for Vercel deployment)
```powershell
.\setup.ps1 setup-tunnel
```

## Project Structure

```
PNSB/
├── autocount-api/              # IIS REST API
│   ├── AutoCountApi/           # Main API project
│   └── Installer/              # Installation scripts
│       └── tunnel-service.ps1  # Master tunnel management script
└── website/                    # Next.js website
    ├── app/api/autocount/     # API routes
    └── lib/                    # API client library
```

## What Has Been Built

### 1. IIS REST API (ASP.NET Core)

**Location:** `autocount-api/AutoCountApi/`

A complete REST API hosted on IIS that provides posting-safe operations for AutoCount integration.

**Components:**
- **Controllers:** Debtors, Items, Invoices, Delivery Orders
- **Services:** Business logic layer for all operations
- **Middleware:** API key authentication, IP allowlist, audit logging
- **Models:** Data transfer objects and request/response models
- **Reliability:** Idempotency service, document locking service

**Key Features:**
- ✅ API key authentication
- ✅ IP-based access control
- ✅ Complete audit trail logging
- ✅ Idempotency to prevent duplicate operations
- ✅ Document locking for concurrent updates
- ✅ Health check endpoints
- ✅ Swagger/OpenAPI documentation

### 2. Master Data Operations (Full CRUD)

**Debtors (Customers):**
- List customers with pagination and search
- Get customer by account number
- Create new customer
- Update customer information
- Soft delete (set inactive)

**Items (Products):**
- List items with pagination and search
- Get item by code
- Create new item
- Update item information
- Soft delete (set inactive)

### 3. Transaction Operations (Lifecycle Management)

**Invoices:**
- Create draft invoice
- Get invoice by DocKey or DocNo
- Update draft invoice (draft only)
- Post invoice (moves from draft to posted)
- Void invoice (cancels posted invoice)

**Delivery Orders:**
- Create draft delivery order
- Get delivery order by DocKey or DocNo
- Update draft delivery order (draft only)
- Post delivery order
- Void delivery order

**Important:** Transactions follow a strict lifecycle: **Draft → Post → Void**. Only draft documents can be updated, ensuring data integrity.

### 4. Website API Client Library

**Location:** `website/lib/autocount-api-client.ts`

A complete TypeScript client library for the website to interact with the IIS API.

**Features:**
- Full type definitions for all models
- All endpoint methods implemented
- Error handling and timeout support
- Singleton instance helper for easy usage

### 5. Migrated API Routes

**Location:** `website/app/api/autocount/*-v2/`

All routes migrated to use IIS API instead of direct database access:
- `customers` - Customer operations using API client
- `invoices-v2` - Invoice operations using API client
- `delivery-orders-v2` - Delivery order operations using API client
- `products-v2` - Product operations using API client

## Installation Guide

### Part 1: IIS API Setup (AutoCount Server)

#### Prerequisites

**On AutoCount Windows Server:**
- Windows Server 2016 or later (or Windows 10/11 for development)
- Administrator privileges
- **IIS (Internet Information Services)** - will be installed by installer if missing
- **.NET 8.0 Hosting Bundle** - must be installed separately
- SQL Server with AutoCount Accounting v2.2 database
- Network connectivity to website server

#### Step 1: Install Prerequisites

**Install .NET 8.0 Hosting Bundle:**
1. Download from: https://dotnet.microsoft.com/download/dotnet/8.0
2. Look for **"ASP.NET Core Runtime 8.0.x - Windows Hosting Bundle"**
3. Run the installer
4. Restart the computer if prompted

**Install IIS (if needed):**
```powershell
.\setup.ps1 install-iis
```

#### Step 2: Build the API

```powershell
cd autocount-api\AutoCountApi
dotnet restore
dotnet build
dotnet publish -c Release -o ./publish
cd ..\..
```

#### Step 3: Install API

```powershell
.\setup.ps1 install-api
```

Or manually:
```powershell
cd autocount-api\Installer
.\install.ps1
```

The installer will:
- Check prerequisites (.NET 8.0, IIS)
- Enable IIS features if needed
- Install API to: `C:\inetpub\wwwroot\AutoCountApi`
- Create IIS application pool
- Create IIS site
- Configure firewall rules
- Test the API

#### Step 4: Configure the API

1. Edit `C:\inetpub\wwwroot\AutoCountApi\appsettings.json`

2. **Configure Database Connection:**
   ```json
   {
     "ConnectionStrings": {
       "AutoCountDb": "Server=YOUR_SERVER\\A2006;Database=AED_TEST;User Id=sa;Password=YOUR_PASSWORD;Encrypt=false;TrustServerCertificate=true;Connection Timeout=30;"
     }
   }
   ```

3. **Configure API Settings:**
   ```json
   {
     "ApiSettings": {
       "ApiKey": "generate-secure-random-key-here",
       "AllowedIPs": [
         "127.0.0.1",
         "YOUR_WEBSITE_SERVER_IP"
       ],
       "AllowedOrigins": [
         "https://your-website.com"
       ],
       "EnableAuditLogging": true
     }
   }
   ```

4. **Generate Secure API Key:**
   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

5. **Restart Application Pool:**
   ```powershell
   Restart-WebAppPool -Name AutoCountApiAppPool
   ```

### Part 2: Website Configuration

#### Step 1: Update Environment Variables

1. Edit `website/.env.local` (create if it doesn't exist)

2. **Add AutoCount API Configuration:**
   ```env
   # AutoCount API Configuration
   AUTOCOUNT_API_BASE_URL=http://your-autocount-server:5001
   AUTOCOUNT_API_KEY=your-api-key-from-step-3
   ```

#### Step 2: Test API Connection

```powershell
cd website
npm run dev
```

Test: `http://localhost:3000/api/autocount/customers`

### Part 3: Cloudflare Tunnel Setup (For Vercel Deployment)

#### Step 1: Download cloudflared

```powershell
.\setup.ps1 setup-tunnel
```

Or manually:
```powershell
cd autocount-api\Installer
.\setup-cloudflare-tunnel.ps1
```

#### Step 2: Authenticate

```powershell
cd C:\cloudflared
.\cloudflared.exe tunnel login
```

#### Step 3: Create Tunnel

```powershell
.\cloudflared.exe tunnel create autocount-api
```

#### Step 4: Configure Tunnel

```powershell
cd autocount-api\Installer
.\configure-tunnel.ps1
```

This creates `C:\cloudflared\config.yml` with your tunnel configuration.

#### Step 5: Install Tunnel Service

```powershell
cd autocount-api\Installer
.\tunnel-service.ps1 install
```

#### Step 6: Verify Tunnel

```powershell
.\tunnel-service.ps1 status
```

Wait 1-2 minutes, then test: `https://api.pnsbmy.com/api/v1/health`

#### Step 7: Update Vercel Environment Variables

In Vercel dashboard → Settings → Environment Variables:

- **Production:**
  - `AUTOCOUNT_API_BASE_URL` = `https://api.pnsbmy.com`
  - `AUTOCOUNT_API_KEY` = `your-api-key`

- **Preview:** Same as production

- **Development:**
  - `AUTOCOUNT_API_BASE_URL` = `http://localhost:5001`

#### Step 8: Update IIS API CORS

Edit `C:\inetpub\wwwroot\AutoCountApi\appsettings.json`:

```json
{
  "ApiSettings": {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://localhost:3000",
      "https://your-vercel-app.vercel.app",
      "https://your-custom-domain.com"
    ]
  }
}
```

Restart IIS app pool:
```powershell
Restart-WebAppPool -Name AutoCountApiAppPool
```

## API Endpoints

### Master Data
- `GET /api/v1/debtors` - List customers
- `GET /api/v1/debtors/{accNo}` - Get customer
- `POST /api/v1/debtors` - Create customer
- `PUT /api/v1/debtors/{accNo}` - Update customer
- `DELETE /api/v1/debtors/{accNo}` - Soft delete customer
- `GET /api/v1/items` - List items
- `GET /api/v1/items/{itemCode}` - Get item
- `POST /api/v1/items` - Create item
- `PUT /api/v1/items/{itemCode}` - Update item
- `DELETE /api/v1/items/{itemCode}` - Soft delete item

### Transactions
- `POST /api/v1/invoices/draft` - Create draft invoice
- `GET /api/v1/invoices/{docKey}` - Get invoice
- `PUT /api/v1/invoices/{docKey}` - Update draft invoice
- `POST /api/v1/invoices/{docKey}/post` - Post invoice
- `POST /api/v1/invoices/{docKey}/void` - Void invoice
- `POST /api/v1/delivery-orders/draft` - Create draft delivery order
- `GET /api/v1/delivery-orders/{docKey}` - Get delivery order
- `PUT /api/v1/delivery-orders/{docKey}` - Update draft delivery order
- `POST /api/v1/delivery-orders/{docKey}/post` - Post delivery order
- `POST /api/v1/delivery-orders/{docKey}/void` - Void delivery order

### System
- `GET /api/v1/health` - Health check
- `GET /api/v1/version` - API version information

## Core Principles

✅ **No Direct SQL on Transactions:** All transaction writes go through AutoCount logic  
✅ **Posting-Safe:** Accounting integrity is maintained  
✅ **Master Data CRUD:** Full create, read, update, soft delete support  
✅ **Transaction Lifecycle:** Draft → Post → Void workflow  
✅ **Security:** API key auth, IP allowlist, audit logging  
✅ **Reliability:** Idempotency, locking, health checks  
✅ **Easy Installation:** One-click installer for non-technical users  

## Scripts Reference

### Master Setup Script

**Location:** `setup.ps1` (project root)

**Usage:**
```powershell
.\setup.ps1 [action]
```

**Actions:**
- `check-prereqs` - Check prerequisites
- `install-iis` - Install IIS
- `install-api` - Install IIS API
- `restart-api` - Restart IIS API
- `update-api` - Update IIS API
- `find-autocount` - Find AutoCount installation
- `find-database` - Find AutoCount database
- `setup-tunnel` - Setup Cloudflare Tunnel
- `configure-tunnel` - Configure tunnel
- `tunnel-status` - Check tunnel status
- `tunnel-fix` - Fix tunnel issues
- `tunnel-debug` - Debug tunnel

### Tunnel Service Script

**Location:** `autocount-api/Installer/tunnel-service.ps1`

**Usage:**
```powershell
cd autocount-api\Installer
.\tunnel-service.ps1 [action]
```

**Actions:**
- `status` (default) - Check service health
- `install` - Install service
- `start` - Start service
- `stop` - Stop service
- `restart` - Restart service
- `fix` - Fix crashing service
- `debug` - Run manually to see errors

## Troubleshooting

### API Not Responding

**Check:**
1. IIS application pool is running
2. Port is not blocked by firewall
3. Check logs: `C:\inetpub\wwwroot\AutoCountApi\Logs\app-*.log`

**Solution:**
```powershell
# Check application pool status
Get-WebAppPoolState -Name AutoCountApiAppPool

# Start if stopped
Start-WebAppPool -Name AutoCountApiAppPool

# Restart API
.\setup.ps1 restart-api
```

### Authentication Failures

**Check:**
1. API key matches in both client and server
2. IP address is in allowlist
3. `X-API-Key` header is being sent

**Solution:**
- Verify API key in `appsettings.json` matches website `.env.local`
- Add your IP to `AllowedIPs` in `appsettings.json`
- Check audit logs: `C:\inetpub\wwwroot\AutoCountApi\Logs\audit.log`

### Database Connection Errors

**Check:**
1. Connection string format is correct
2. SQL Server is accessible
3. SQL Server authentication mode allows SQL authentication

**Solution:**
- Test connection: `sqlcmd -S YOUR_SERVER\A2006 -U sa -P YOUR_PASSWORD`
- Verify connection string format
- Check SQL Server Browser service is running

### Website Can't Connect to API

**Check:**
1. API is accessible from website server
2. Network connectivity (ping, telnet)
3. Firewall rules allow traffic
4. CORS settings if using browser

**Solution:**
```powershell
# Test connectivity from website server
Test-NetConnection -ComputerName your-autocount-server -Port 5001

# Check if API responds
Invoke-WebRequest -Uri "http://your-autocount-server:5001/api/v1/health"
```

### Cloudflare Tunnel Error 1033

**Problem:** Tunnel is down or not connecting

**Solution:**
```powershell
cd autocount-api\Installer
.\tunnel-service.ps1 fix
```

**Check status:**
```powershell
.\tunnel-service.ps1 status
```

**Debug:**
```powershell
.\tunnel-service.ps1 debug
```

### Service Crashes

**Problem:** Service starts but crashes immediately

**Solution:**
```powershell
cd autocount-api\Installer
.\tunnel-service.ps1 fix
```

This will reinstall the service with correct configuration.

## Migration Status

### ✅ Fully Migrated Pages

1. **Invoices Page** (`/dashboard/invoices`)
   - Uses `/api/autocount/invoices-v2` (IIS API)
   - Uses `/api/autocount/customers` (IIS API)
   - Uses `/api/autocount/products-v2` (IIS API)

2. **Delivery Orders Page** (`/dashboard/delivery-orders`)
   - Uses `/api/autocount/delivery-orders-v2` (IIS API)
   - Uses `/api/autocount/customers` (IIS API)
   - Uses `/api/autocount/products-v2` (IIS API)

3. **Products Page** (`/dashboard/products`)
   - Uses `/api/autocount/products-v2` (IIS API)

4. **Customers Page** (`/dashboard/customers`)
   - Uses `/api/autocount/customers` (IIS API)

### ✅ Migrated Routes

- `/api/autocount/customers` - GET, POST
- `/api/autocount/customers/[accNo]` - GET, PUT, DELETE
- `/api/autocount/invoices-v2` - GET, POST
- `/api/autocount/invoices-v2/[docKey]` - GET, PUT, DELETE
- `/api/autocount/delivery-orders-v2` - GET, POST
- `/api/autocount/delivery-orders-v2/[docKey]` - GET, PUT, DELETE
- `/api/autocount/products-v2` - GET

## Logs Location

- **API Logs:** `C:\inetpub\wwwroot\AutoCountApi\Logs\app-*.log`
- **Audit Logs:** `C:\inetpub\wwwroot\AutoCountApi\Logs\audit.log`
- **IIS Logs:** `C:\inetpub\logs\LogFiles\`
- **Windows Event Viewer:** Application logs

## Quick Reference

**API Base URL:** `http://your-autocount-server:5001`  
**Health Check:** `GET /api/v1/health`  
**Swagger UI:** `http://your-autocount-server:5001/swagger`  
**API Key Header:** `X-API-Key: your-api-key`  
**Tunnel URL:** `https://api.pnsbmy.com`  
**Tunnel Service:** `autocount-api\Installer\tunnel-service.ps1`

## Technology Stack

- **IIS API:** ASP.NET Core 8.0, C#
- **Website:** Next.js 14, TypeScript, React
- **Database:** SQL Server (AutoCount database)
- **Authentication:** Clerk (website), API Key (IIS API)
- **Tunnel:** Cloudflare Tunnel
- **Logging:** Serilog
- **Documentation:** Swagger/OpenAPI

## Security Features

- **API Key Authentication:** All requests require valid API key
- **IP Allowlist:** Restrict access to specific IP addresses
- **Audit Logging:** Complete request/response logging with timestamps
- **HTTPS Support:** Secure communication via Cloudflare Tunnel
- **Request Validation:** Input validation on all endpoints
- **WordPress Scanner Blocking:** Middleware blocks common bot/scanner requests

## Status

✅ **COMPLETE** - All core requirements implemented and ready for deployment.

The system is ready for:
- Local testing
- Staging deployment
- Production deployment

---

**For detailed installation instructions, see the setup script help:**
```powershell
.\setup.ps1 help
```

