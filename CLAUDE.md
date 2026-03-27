# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PNSB is a **posting-safe AutoCount Accounting integration** — a cloud website for managing AutoCount Accounting data. All transaction operations route through AutoCount's business logic via an on-premise IIS API; direct SQL writes on transaction tables are strictly forbidden.

**Architecture:**
```
Next.js (Vercel) → HTTPS (Cloudflare Tunnel) → IIS REST API (ASP.NET Core) → AutoCount Business Logic → SQL Server
```

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript (strict, no `any`), Tailwind CSS + shadcn/ui, lucide-react
- **Auth:** Clerk (middleware protection, `auth()` helper)
- **Database:** Convex (users, branches, temporary receipts, stock keeping)
- **Backend API:** ASP.NET Core 8.0 on IIS (on-premise), accessed via `lib/autocount-api-client.ts`
- **Tunnel:** Cloudflare Tunnel (exposes on-premise API to Vercel)

## Development Commands

```bash
# Website (from website/)
npm run dev              # Dev server on localhost:3000
npm run build            # Production build
npm run lint             # ESLint
npm run convex:dev       # Start Convex dev (generates types)
npm run convex:deploy    # Deploy Convex schema/functions

# AutoCount API (from autocount-api/AutoCountApi/)
dotnet restore && dotnet build
dotnet publish -c Release -o ./publish

# Setup script (from project root, PowerShell)
.\setup.ps1 install-api     # Install IIS API
.\setup.ps1 restart-api     # Restart IIS API
.\setup.ps1 update-api      # Update after rebuild
.\setup.ps1 tunnel-status   # Check Cloudflare Tunnel
```

## Critical Rules

### 1. Posting-Safe Principle (STRICT)
**NEVER** write direct SQL INSERT/UPDATE/DELETE on transaction tables (ARInvoice, ARInvoiceDtl, ARDeliveryOrder, ARDeliveryOrderDtl). All transaction operations must go through the IIS API. Master data (Customers, Products) and Convex tables allow full CRUD.

Transaction lifecycle: **Draft → Post → Void**. Only drafts can be edited.

### 2. Layout Pattern
**NEVER** import or render Sidebar in `page.tsx`. Navigation lives in `app/dashboard/layout.tsx` only. Dashboard main content uses `lg:pl-72` offset to account for the fixed sidebar width.

### 3. Authentication
- All `/dashboard/*` routes are protected by Clerk middleware (`middleware.ts`)
- API routes: always call `await auth()` and check `userId` before processing
- Convex mutations/queries: always call `await ctx.auth.getUserIdentity()` and throw if null

### 4. API Integration
Use the IIS API client, never direct database access:
```typescript
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
const apiClient = getAutoCountApiClient()
const response = await apiClient.getDebtors({ page: 1, pageSize: 50 })
```

### 5. Type Safety
Use Convex generated types (`Doc<"tableName">`, `Id<"tableName">` from `convex/_generated/dataModel`). Never manually define database types. Validate mutation args with `v` (Convex validators) or Zod.

## Key Architecture

### Data Flow
- **AutoCount data** (customers, products, invoices, DOs): Next.js API routes in `app/api/autocount/` proxy to IIS API via `lib/autocount-api-client.ts`
- **App data** (users, branches, temp receipts, stock): Convex queries/mutations in `convex/`
- **Auth**: Clerk webhook (`app/api/webhooks/clerk/`) syncs users to Convex

### Convex Tables
- **users**: Clerk users with roles (`super_admin`, `admin`, `staff`) and branch assignment
- **branches**: Physical branches with DO/TR numbering prefixes
- **temporaryReceipts**: Custom receipt system (not in AutoCount)
- **stockBalances**: Per-branch stock tracking (Phase 1, preferred over legacy `stockKeeping`)
- **stockMovements**: Audit trail for stock changes
- **deliveryOrderBranches**: Maps AutoCount DOs to branches

### Role-Based Access
Permissions defined in `lib/permissions.ts`. Three roles: `super_admin` (full access), `admin` (branch management), `staff` (branch-specific operations).

### Key Files
- `website/lib/autocount-api-client.ts` — TypeScript client for all IIS API calls
- `website/lib/autocount-api-client-instance.ts` — Singleton accessor
- `website/lib/permissions.ts` — Role-based permission logic
- `website/middleware.ts` — Clerk auth middleware
- `website/components/dashboard/ModernSidebar.tsx` — Main navigation
- `website/convex/schema.ts` — Convex database schema

## Design System

Light mode only. Optimized for data legibility and low eye strain per `MD_Files/design.md`.
- Background: `#F4F5F7` (not pure white)
- All numeric columns: `font-variant-numeric: tabular-nums; text-align: right;`
- Financial colors: Green (#006644) = revenue/paid, Red (#DE350B) = expense/overdue, Orange (#FF991F) = pending/draft

## Important Notes

- Invoice pages exist in code but are **hidden from UI** — delivery orders are the primary workflow
- Temporary receipts are stored in **Convex**, not AutoCount
- Document numbering uses **branch prefixes** (e.g., "SOTP1-000001")
- `MD_Files/FIXES_REQUIRED.md` tracks known security/consistency issues
- `MD_Files/IMPLEMENTATION_PLAN.md` has the phased fix plan
- Never use `useEffect` for initial data fetching — use Convex `useQuery` or React Server Components
- Every `page.tsx` should export `metadata`
