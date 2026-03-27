# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **posting-safe AutoCount Accounting integration** that provides a cloud-based interface for managing AutoCount Accounting data. The system ensures accounting integrity by routing all transaction operations through AutoCount's business logic, never performing direct SQL writes on transactions.

**Architecture:**
```
Next.js (Vercel Cloud)
    ↓ HTTPS (Cloudflare Tunnel)
IIS REST API (ASP.NET Core on Windows Server)
    ↓ AutoCount Business Logic
SQL Server (AutoCount Database)
```

## Technology Stack

### Frontend (website/)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode, no `any`)
- **Auth:** Clerk (middleware protection, `auth()` helper)
- **Database:** Convex (users, temporary receipts, branches, stock keeping)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Icons:** lucide-react

### Backend Integration
- **IIS API:** ASP.NET Core 8.0 REST API (on-premise)
- **API Client:** `lib/autocount-api-client.ts` (TypeScript client)
- **Tunnel:** Cloudflare Tunnel (Windows Service)
- **AutoCount:** Version 2.2 (accounting logic layer)

## Development Commands

### Website (Next.js)
```bash
cd website
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run convex:dev       # Start Convex development
npm run convex:deploy    # Deploy Convex schema/functions
```

### AutoCount API (IIS)
```powershell
# Build API
cd autocount-api\AutoCountApi
dotnet restore
dotnet build
dotnet publish -c Release -o ./publish

# Installation & Management (from project root)
.\setup.ps1 install-api     # Install IIS API
.\setup.ps1 restart-api     # Restart IIS API
.\setup.ps1 update-api      # Update IIS API after rebuild

# Cloudflare Tunnel Management
.\setup.ps1 tunnel-status   # Check tunnel status
.\setup.ps1 tunnel-fix      # Fix tunnel issues
cd autocount-api\Installer
.\tunnel-service.ps1 status # Detailed service status
```

## Critical Architecture Rules

### 1. Posting-Safe Principle (STRICT)
**NEVER write direct SQL INSERT/DELETE operations on transaction tables.** All transaction operations MUST go through AutoCount's business logic via the IIS API.

**Transaction Lifecycle:** Draft → Post → Void
- **Draft:** Can be edited, not yet in accounting books
- **Posted:** Finalized, cannot be edited, affects accounting
- **Voided:** Cancelled, reverses the accounting impact

**Affected Tables/Operations:**
- Invoices (ARInvoice, ARInvoiceDtl)
- Delivery Orders (ARDeliveryOrder, ARDeliveryOrderDtl)
- All accounting transaction tables

**Safe Operations:**
- ✅ Master data (Customers, Products) - Full CRUD allowed
- ✅ Non-accounting tables (users, branches, temp receipts in Convex)
- ✅ Transaction operations via IIS API endpoints
- ❌ Direct SQL on transaction tables

### 2. Layout & Navigation Pattern
**NEVER import or render Sidebar directly in page.tsx files.** Navigation MUST be in `layout.tsx`.

**Correct Pattern:**
```tsx
// app/dashboard/layout.tsx
import { ModernSidebar } from '@/components/dashboard/ModernSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <ModernSidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
```

### 3. Authentication & Security
**All protected routes require Clerk authentication.**

**API Route Pattern:**
```typescript
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  // ALWAYS verify authentication first
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... rest of handler
}
```

**Convex Queries/Mutations:**
```typescript
export const myMutation = mutation({
  handler: async (ctx, args) => {
    // ALWAYS check authentication
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    // ... rest of handler
  }
})
```

**Protected routes:** All `/dashboard/*` routes (configured in `middleware.ts`)

### 4. API Integration Pattern
**Use the IIS API client, not direct database access.**

**Correct Pattern:**
```typescript
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'

const apiClient = getAutoCountApiClient()
const response = await apiClient.getDebtors({ page: 1, pageSize: 50 })

if (!response.success) {
  // Handle error
  return NextResponse.json({ error: response.error }, { status: 500 })
}

// Use response.data
```

**All AutoCount API routes follow this pattern:**
1. Verify Clerk authentication
2. Parse/validate request
3. Call IIS API client
4. Transform response to match frontend format
5. Return JSON response

### 5. Type Safety
**Use Convex generated types, never manually define database types.**

```typescript
import { Doc, Id } from "../convex/_generated/dataModel"

// ✅ Correct
const userId: Id<"users"> = "..."
const user: Doc<"users"> = await ctx.db.get(userId)

// ❌ Wrong
interface User { clerkId: string, ... } // Don't manually define
```

## Project Structure

```
PNSB/
├── autocount-api/              # IIS REST API (ASP.NET Core)
│   ├── AutoCountApi/           # Main API project
│   │   ├── Controllers/        # REST endpoints
│   │   ├── Services/           # Business logic
│   │   ├── Models/             # DTOs
│   │   └── Middleware/         # Auth, logging
│   └── Installer/              # Installation scripts
│       ├── install.ps1         # IIS API installer
│       └── tunnel-service.ps1  # Cloudflare tunnel management
├── setup.ps1                   # Master setup script
└── website/                    # Next.js application
    ├── app/
    │   ├── api/
    │   │   ├── autocount/      # Proxy to IIS API
    │   │   │   ├── customers/
    │   │   │   ├── products-v2/
    │   │   │   ├── delivery-orders-v2/
    │   │   │   └── invoices-v2/ (hidden from UI)
    │   │   ├── temporary-receipts/
    │   │   └── webhooks/clerk/
    │   ├── dashboard/           # Main application
    │   │   ├── layout.tsx       # Contains <ModernSidebar />
    │   │   ├── page.tsx         # Financial overview
    │   │   ├── customers/
    │   │   ├── products/
    │   │   ├── delivery-orders/
    │   │   ├── temporary-receipts/
    │   │   ├── users/
    │   │   ├── branches/
    │   │   └── stock-keeping/
    │   └── sign-in/[[...rest]]/
    ├── components/
    │   ├── dashboard/
    │   │   ├── ModernSidebar.tsx
    │   │   ├── Overview.tsx     # Cash flow chart
    │   │   └── RecentActivity.tsx
    │   └── ui/                  # shadcn/ui components
    ├── convex/
    │   ├── schema.ts            # Database schema
    │   ├── users.ts
    │   ├── branches.ts
    │   ├── temporaryReceipts.ts
    │   └── stockKeeping.ts
    ├── lib/
    │   ├── autocount-api-client.ts          # IIS API TypeScript client
    │   ├── autocount-api-client-instance.ts # Singleton helper
    │   └── permissions.ts       # Role-based permissions
    ├── middleware.ts            # Clerk auth middleware
    └── next.config.js
```

## Key Data Models

### Convex Tables
- **users:** Clerk users with roles (super_admin, admin, staff) and branch assignment
- **branches:** Physical branches with DO/TR numbering prefixes
- **temporaryReceipts:** Custom receipt system (not in AutoCount)
- **deliveryOrderBranches:** Maps AutoCount DOs to branches
- **branchProductTemplates:** Pre-configured products per branch
- **stockBalances:** Per-branch stock tracking
- **stockMovements:** Audit trail for stock changes

### AutoCount (via IIS API)
- **Debtors:** Customers
- **Items:** Products/inventory items
- **ARDeliveryOrder:** Sales delivery orders
- **ARInvoice:** Customer invoices (hidden from UI)

## Design System

The UI follows a professional accounting design system optimized for **low eye strain** and **data legibility**. See `design.md` for full specifications.

**Key Principles:**
- Light mode only (no dark mode)
- Cool tones (#F4F5F7 background, not pure white)
- Tabular figures for all numbers (aligned decimals)
- Right-align all numeric columns
- Financial semantic colors:
  - Green (#006644): Revenue, assets, "Paid"
  - Red (#DE350B): Expenses, liabilities, "Overdue"
  - Orange (#FF991F): Pending, draft, warnings
  - Purple (#403294): Audited, reconciled

**Important CSS Classes:**
```css
.numeric-data {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

## Environment Variables

### Website (.env.local)
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Convex
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=https://...

# AutoCount API
AUTOCOUNT_API_BASE_URL=https://api.pnsbmy.com  # Production (Cloudflare Tunnel)
# AUTOCOUNT_API_BASE_URL=http://localhost:5001   # Local development
AUTOCOUNT_API_KEY=your-secure-api-key
```

### IIS API (appsettings.json)
Located at `C:\inetpub\wwwroot\AutoCountApi\appsettings.json`
```json
{
  "ConnectionStrings": {
    "AutoCountDb": "Server=...;Database=AED_TEST;..."
  },
  "ApiSettings": {
    "ApiKey": "your-secure-api-key",
    "AllowedIPs": ["127.0.0.1", "YOUR_WEBSITE_SERVER_IP"],
    "AllowedOrigins": ["https://your-vercel-app.vercel.app"]
  }
}
```

## Common Patterns

### Creating a New Dashboard Page

1. **Create page in app/dashboard/[page-name]/page.tsx**
2. **Add metadata export**
3. **DO NOT import Sidebar** (it's in layout.tsx)
4. **Use Clerk auth if needed** (already protected by middleware)
5. **Add to sidebar navigation** in `components/dashboard/ModernSidebar.tsx`

### Creating a New API Route

1. **Create in app/api/[route-name]/route.ts**
2. **Add Clerk authentication check**
3. **Use IIS API client for AutoCount data**
4. **Transform response to match frontend format**
5. **Handle errors appropriately**

### Adding Convex Functionality

1. **Define schema** in `convex/schema.ts`
2. **Run** `npm run convex:dev` to generate types
3. **Create query/mutation** in `convex/[table].ts`
4. **Use generated types** from `_generated/dataModel`
5. **Always check authentication** in mutations

### Working with AutoCount Data

**Read Operations:**
```typescript
const apiClient = getAutoCountApiClient()
const result = await apiClient.getDebtors({ page: 1, pageSize: 50 })
```

**Create/Update/Delete:**
```typescript
const apiClient = getAutoCountApiClient()

// Create
await apiClient.createDebtor({ accNo: "D001", name: "Customer" })

// Update
await apiClient.updateDebtor("D001", { name: "Updated Name" })

// Delete (soft delete)
await apiClient.deleteDebtor("D001")
```

**Transactions (Draft → Post → Void):**
```typescript
// Create draft
const draft = await apiClient.createDeliveryOrder({ ... })

// Post (finalize)
await apiClient.postDeliveryOrder(draft.data.docKey)

// Void (cancel)
await apiClient.voidDeliveryOrder(draft.data.docKey)
```

## Role-Based Permissions

Users have roles that control access:
- **super_admin:** Full system access
- **admin:** Branch management, user management (limited)
- **staff:** Branch-specific operations only

**Check permissions:**
```typescript
import { getUserPermissions } from '@/lib/permissions'

const permissions = await getUserPermissions(userId)
if (!permissions.canManageUsers) {
  throw new Error("Unauthorized")
}
```

## Important Notes

1. **Invoice pages exist but are hidden from UI** - delivery orders are used instead for the main workflow
2. **Stock keeping has two systems:**
   - Legacy: `stockKeeping` table (global)
   - Phase 1: `stockBalances` table (per-branch, preferred)
3. **Document numbering uses branch prefixes** (e.g., "SOTP1-000001")
4. **Temporary receipts are stored in Convex**, not AutoCount
5. **Cloudflare Tunnel** exposes on-premise API to Vercel deployment
6. **WordPress scanner blocking** is implemented in middleware and next.config.js

## Testing & Debugging

**Check IIS API health:**
```powershell
# Local
Invoke-WebRequest -Uri "http://localhost:5001/api/v1/health"

# Production
Invoke-WebRequest -Uri "https://api.pnsbmy.com/api/v1/health"
```

**View API logs:**
- Application logs: `C:\inetpub\wwwroot\AutoCountApi\Logs\app-*.log`
- Audit logs: `C:\inetpub\wwwroot\AutoCountApi\Logs\audit.log`

**Debug database explorer:**
Navigate to `/dashboard/debugging/database-explorer` (development only)

## Troubleshooting

**API connection errors:**
1. Check Cloudflare Tunnel: `.\setup.ps1 tunnel-status`
2. Verify environment variables are set correctly
3. Check IIS application pool is running
4. Review API logs

**Authentication issues:**
1. Verify Clerk configuration
2. Check middleware.ts route protection
3. Clear browser cache and cookies

**Build errors:**
1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `npm install`
3. Check TypeScript errors: `npm run lint`
