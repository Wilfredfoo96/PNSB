# PNSB Project: Required Fixes and Action Items

**Generated:** 2026-02-11
**Project Maturity:** 6/10 (Functional but Risky)
**Status:** Critical security and data consistency issues require immediate attention

---

## Executive Summary

The PNSB project has a solid architectural foundation with good separation of concerns and proper implementation of the posting-safe principle. However, there are **critical security vulnerabilities** and **data consistency issues** that must be addressed before production deployment.

**Key Concerns:**
- 🚨 Credentials exposed in git repository
- 🚨 Distributed transaction failures lead to data inconsistency
- 🚨 Race conditions in stock management
- 🚨 SQL injection vulnerabilities
- ⚠️ Type safety violations throughout codebase
- ⚠️ No test coverage

---

## 🚨 PRIORITY 1: CRITICAL (Address This Week)

### 1.1 Security: Exposed Credentials in Repository

**Location:** `website/.env.local`
**Risk Level:** CRITICAL
**Impact:** Full system compromise - database passwords, API keys, Clerk secrets, Convex keys visible in git history

**Action Steps:**
```bash
# Step 1: Rotate ALL credentials immediately
# - Clerk: Regenerate publishable and secret keys at dashboard.clerk.com
# - Convex: Rotate deployment keys at dashboard.convex.dev
# - AutoCount API: Generate new secure random API key
# - SQL Server: Change database password

# Step 2: Remove from git history (DESTRUCTIVE - backup first!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch website/.env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Step 3: Force push to remote (WARNING: Coordinate with team)
git push origin --force --all

# Step 4: Update .gitignore
cat >> .gitignore << 'EOF'

# Environment variables (local only)
**/.env.local
**/.env.*.local
**/appsettings.Development.json
**/appsettings.Production.json
EOF

# Step 5: Create .env.example template
cp website/.env.local website/.env.example
# Then manually replace all values with placeholders like:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
# CLERK_SECRET_KEY=sk_test_your_secret_here
```

**Files to Update:**
- `website/.env.local` → Remove from repository
- `.gitignore` → Add environment file patterns
- `website/.env.example` → Create template with placeholders
- `autocount-api/AutoCountApi/appsettings.json` → Remove sensitive data, use appsettings.Production.json

**Verification:**
```bash
# Verify no credentials in repository
git log --all --full-history --source --pretty=format:"%C(auto)%h%Creset %C(auto)%d%Creset %s" -- "*/.env*"
# Should show no results after cleanup

# Verify .gitignore working
echo "TEST_SECRET=123" >> website/.env.local
git status # Should NOT show .env.local as modified
```

---

### 1.2 Data Integrity: Distributed Transaction Problem

**Location:** `website/app/api/autocount/delivery-orders-v2/route.ts` lines 329-355
**Risk Level:** CRITICAL
**Impact:** Stock deduction fails after DO creation → inventory mismatch, overselling

**Current Problem:**
```typescript
// Commit 1: AutoCount DO created (SUCCESS)
const response = await apiClient.createDraftDeliveryOrder(createRequest)

// Commit 2: Convex stock deducted (FAILS - DO orphaned)
await convex.mutation(api.stockKeeping.adjustStockAndLog, {...})
```

**Solution: Implement Saga Pattern**

**Action Steps:**

1. **Create transaction coordinator:**

```typescript
// File: website/lib/transaction-coordinator.ts
interface TransactionStep {
  execute: () => Promise<void>
  compensate: () => Promise<void>
}

export class SagaCoordinator {
  private steps: TransactionStep[] = []

  async execute(): Promise<void> {
    const executed: TransactionStep[] = []

    try {
      for (const step of this.steps) {
        await step.execute()
        executed.push(step)
      }
    } catch (error) {
      // Rollback in reverse order
      for (let i = executed.length - 1; i >= 0; i--) {
        try {
          await executed[i].compensate()
        } catch (compensateError) {
          console.error('Compensation failed:', compensateError)
        }
      }
      throw error
    }
  }

  addStep(step: TransactionStep): void {
    this.steps.push(step)
  }
}
```

2. **Update delivery order creation:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/route.ts
import { SagaCoordinator } from '@/lib/transaction-coordinator'

// Inside POST handler, replace lines 329-355 with:
const saga = new SagaCoordinator()
let docKey: string | undefined

// Step 1: Create DO in AutoCount
saga.addStep({
  execute: async () => {
    const response = await apiClient.createDraftDeliveryOrder(createRequest)
    if (!response.success) throw new Error(response.error)
    docKey = response.data.docKey
  },
  compensate: async () => {
    if (docKey) {
      await apiClient.voidDeliveryOrder(docKey)
    }
  }
})

// Step 2: Deduct stock in Convex
saga.addStep({
  execute: async () => {
    for (const item of parsedBody.detail) {
      await convex.mutation(api.stockKeeping.adjustStockAndLog, {
        itemCode: item.itemCode,
        quantity: -item.qty,
        reason: 'Sales',
        docKey: docKey!,
      })
    }
  },
  compensate: async () => {
    // Reverse stock deductions
    for (const item of parsedBody.detail) {
      await convex.mutation(api.stockKeeping.adjustStockAndLog, {
        itemCode: item.itemCode,
        quantity: item.qty,
        reason: 'Sales Reversal',
        docKey: docKey!,
      })
    }
  }
})

// Execute saga with automatic rollback on failure
await saga.execute()
```

**Files to Update:**
- `website/lib/transaction-coordinator.ts` → Create saga coordinator
- `website/app/api/autocount/delivery-orders-v2/route.ts` → Implement saga pattern
- `website/convex/stockKeeping.ts` → Add reversal operation support

**Testing:**
```typescript
// Create test cases for failure scenarios:
// 1. DO creation succeeds, stock deduction fails → DO should be voided
// 2. DO creation fails → No stock deduction attempted
// 3. Network timeout during stock deduction → Rollback occurs
```

---

### 1.3 Concurrency: Race Conditions in Stock Adjustments

**Location:** `website/convex/stockKeeping.ts`
**Risk Level:** CRITICAL
**Impact:** Concurrent requests cause inventory loss

**Current Problem:**
```typescript
// Thread A reads stock = 100
const current = await ctx.db.query("stockKeeping")
  .withIndex("by_item_code", (q) => q.eq("itemCode", itemCode))
  .first()

// Thread B reads stock = 100 (same value!)

// Thread A writes stock = 90 (for qty 10)
await ctx.db.patch(current._id, { quantity: 90 })

// Thread B writes stock = 85 (for qty 15)
await ctx.db.patch(current._id, { quantity: 85 })

// Result: stock = 85 instead of 75 (LOST 10 UNITS!)
```

**Solution: Optimistic Locking with Version Field**

**Action Steps:**

1. **Update Convex schema:**

```typescript
// File: website/convex/schema.ts
stockKeeping: defineTable({
  itemCode: v.string(),
  quantity: v.number(),
  version: v.number(), // ADD THIS
  lastUpdated: v.number(),
})
  .index("by_item_code", ["itemCode"]),
```

2. **Update stock adjustment mutation:**

```typescript
// File: website/convex/stockKeeping.ts
export const adjustStockAndLog = mutation({
  args: {
    itemCode: v.string(),
    quantity: v.number(),
    reason: v.string(),
    docKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const MAX_RETRIES = 3
    let attempt = 0

    while (attempt < MAX_RETRIES) {
      try {
        // 1. Read current state with version
        const current = await ctx.db.query("stockKeeping")
          .withIndex("by_item_code", (q) => q.eq("itemCode", args.itemCode))
          .first()

        if (!current) {
          throw new Error(`Item ${args.itemCode} not found`)
        }

        const currentVersion = current.version || 0
        const newQuantity = current.quantity + args.quantity

        // Prevent negative stock
        if (newQuantity < 0) {
          throw new Error(`Insufficient stock for ${args.itemCode}. Available: ${current.quantity}, Requested: ${Math.abs(args.quantity)}`)
        }

        // 2. Attempt atomic update with version check
        await ctx.db.patch(current._id, {
          quantity: newQuantity,
          version: currentVersion + 1, // Increment version
          lastUpdated: Date.now(),
        })

        // 3. Verify the update succeeded (version matches)
        const updated = await ctx.db.get(current._id)
        if (!updated || updated.version !== currentVersion + 1) {
          // Another transaction modified the record - retry
          attempt++
          continue
        }

        // 4. Log the movement
        await ctx.db.insert("stockMovementLogs", {
          itemCode: args.itemCode,
          quantityChange: args.quantity,
          previousQuantity: current.quantity,
          newQuantity: newQuantity,
          reason: args.reason,
          docKey: args.docKey,
          timestamp: Date.now(),
          userId: identity.subject,
        })

        return { success: true, newQuantity }

      } catch (error) {
        if (attempt >= MAX_RETRIES - 1) {
          throw error
        }
        attempt++
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
      }
    }

    throw new Error("Failed to adjust stock after retries")
  },
})
```

**Files to Update:**
- `website/convex/schema.ts` → Add version field
- `website/convex/stockKeeping.ts` → Implement optimistic locking
- `website/convex/stockBalances.ts` → Apply same pattern (if using per-branch stock)

**Verification:**
```typescript
// Load test: Run 100 concurrent stock adjustments
// Expected: All adjustments recorded, no inventory loss
// Actual: Verify sum of movements equals final stock level
```

---

### 1.4 Security: SQL Injection Vulnerability

**Location:** `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs` line 55
**Risk Level:** CRITICAL
**Impact:** Database compromise via malicious status parameter

**Current Problem:**
```csharp
// Line 55: String concatenation in WHERE clause
whereClause += $" AND ({statusFilter})";
// statusFilter is built from switch statement, but pattern is fragile
```

**Solution: Use Parameterized Query Builder**

**Action Steps:**

1. **Refactor to use parameterized queries:**

```csharp
// File: autocount-api/AutoCountApi/Services/DeliveryOrderService.cs
// Replace lines 30-65 with:

public async Task<(List<DeliveryOrderDto> Items, int TotalCount)> GetDeliveryOrders(
    int page,
    int pageSize,
    string? status = null)
{
    try
    {
        using var connection = await _dbService.GetConnectionAsync();

        // Build parameterized query
        var parameters = new DynamicParameters();
        var whereConditions = new List<string>();

        // Status filter with parameterized values
        if (!string.IsNullOrEmpty(status))
        {
            switch (status.ToUpper())
            {
                case "DRAFT":
                    whereConditions.Add("(do.Cancelled = @IsDraft AND do.Transferred = @IsNotTransferred)");
                    parameters.Add("IsDraft", "F");
                    parameters.Add("IsNotTransferred", "F");
                    break;
                case "POSTED":
                    whereConditions.Add("(do.Cancelled = @IsPosted AND do.Transferred = @IsTransferred)");
                    parameters.Add("IsPosted", "F");
                    parameters.Add("IsTransferred", "T");
                    break;
                case "VOID":
                    whereConditions.Add("do.Cancelled = @IsVoid");
                    parameters.Add("IsVoid", "T");
                    break;
                default:
                    throw new ArgumentException($"Invalid status: {status}");
            }
        }

        // Build WHERE clause
        string whereClause = whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", whereConditions)
            : "";

        // Count query
        string countQuery = $@"
            SELECT COUNT(*)
            FROM ARDeliveryOrder do
            {whereClause}";

        int totalCount = await connection.ExecuteScalarAsync<int>(countQuery, parameters);

        // Pagination parameters
        parameters.Add("Offset", (page - 1) * pageSize);
        parameters.Add("PageSize", pageSize);

        // Data query
        string query = $@"
            SELECT
                do.DocKey,
                do.DocNo,
                do.DocDate,
                do.DebtorCode,
                d.CompanyName AS DebtorName,
                do.Description,
                do.DocAmt,
                do.Cancelled,
                do.Transferred
            FROM ARDeliveryOrder do
            LEFT JOIN Debtor d ON do.DebtorCode = d.AccNo
            {whereClause}
            ORDER BY do.DocDate DESC, do.DocNo DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY";

        var items = await connection.QueryAsync<DeliveryOrderDto>(query, parameters);

        return (items.ToList(), totalCount);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error retrieving delivery orders");
        throw;
    }
}
```

**Files to Update:**
- `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs` → Refactor query building
- `autocount-api/AutoCountApi/Services/InvoiceService.cs` → Apply same pattern
- `autocount-api/AutoCountApi/Services/ItemService.cs` → Review for similar issues

**Verification:**
```csharp
// Unit test: Pass malicious status parameter
var result = await service.GetDeliveryOrders(1, 10, "'; DROP TABLE ARDeliveryOrder; --");
// Expected: ArgumentException thrown
// Actual: Verify no SQL executed
```

---

## ⚠️ PRIORITY 2: HIGH (Address This Month)

### 2.1 Type Safety: Remove All `any` Types

**Location:** Multiple files in `website/app/api/autocount/`
**Risk Level:** HIGH
**Impact:** Runtime errors, undefined behavior, type-related bugs

**Files with `any` violations:**
- `delivery-orders-v2/route.ts` lines 135, 142, 319
- `products-v2/route.ts` lines 78, 92
- `customers/route.ts` lines 45, 67

**Action Steps:**

1. **Enable strict TypeScript linting:**

```json
// File: website/.eslintrc.json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error"
  }
}
```

2. **Define proper types:**

```typescript
// File: website/lib/types/delivery-order.ts
export interface DeliveryOrderItem {
  DocKey: string
  docKey?: string // Handle API inconsistency
  DocNo: string
  DocDate: string
  DebtorCode: string
  DebtorName?: string
  Description?: string
  DocAmt: number
  Cancelled: string
  Transferred: string
}

export interface BranchMapping {
  docKey: string
  branchId: string
}
```

3. **Replace `any` casts:**

```typescript
// BEFORE (line 319 in delivery-orders-v2/route.ts):
branchId: branchId as any,

// AFTER:
branchId: branchId as Id<"branches">,
```

**Files to Create:**
- `website/lib/types/delivery-order.ts` → Delivery order types
- `website/lib/types/product.ts` → Product types
- `website/lib/types/customer.ts` → Customer types
- `website/lib/types/api-response.ts` → Generic API response types

**Files to Update:**
- `website/.eslintrc.json` → Add strict rules
- All API route files → Replace `any` with proper types

**Deadline:** End of month
**Owner:** Backend team

---

### 2.2 Performance: Inefficient Branch Filtering

**Location:** `website/app/api/autocount/delivery-orders-v2/route.ts` lines 131-172
**Risk Level:** HIGH
**Impact:** Pagination broken, memory issues with large datasets

**Current Problem:**
```typescript
// Fetches ALL delivery orders (ignoring pagination)
const response = await apiClient.getDeliveryOrders({
  page: 1,
  pageSize: 10000, // Requests ALL records!
  status: statusParam
})

// Then filters in memory
filteredItems = filteredItems.filter((item: any) => {
  return docKeySet.has(itemDocKey)
})

// Returns only matching items (defeats pagination)
// If 100 requested but only 5 match, returns 5 instead of 100
```

**Solution: Server-Side Branch Filtering**

**Action Steps:**

1. **Add branch column to AutoCount (if possible):**

```sql
-- Option A: Add custom field to ARDeliveryOrder (if AutoCount allows)
ALTER TABLE ARDeliveryOrder ADD BranchId NVARCHAR(50) NULL;
CREATE INDEX IX_ARDeliveryOrder_BranchId ON ARDeliveryOrder(BranchId);
```

2. **Or use Convex as source of truth for branch mapping:**

```typescript
// File: website/convex/deliveryOrderBranches.ts
// Add compound index for efficient lookup
export default defineSchema({
  deliveryOrderBranches: defineTable({
    docKey: v.string(),
    branchId: v.id("branches"),
    createdAt: v.number(),
  })
    .index("by_branch_id", ["branchId"])
    .index("by_doc_key", ["docKey"])
    .index("by_branch_and_date", ["branchId", "createdAt"]), // NEW: For pagination
})
```

3. **Refactor API route to paginate correctly:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/route.ts
// Replace lines 131-172 with:

if (branchId) {
  // Step 1: Get paginated docKeys for this branch from Convex
  const branchMappings = await convex.query(
    api.deliveryOrderBranches.getPaginatedByBranch,
    {
      branchId: branchId as Id<"branches">,
      limit: limit,
      offset: (page - 1) * limit,
    }
  )

  const docKeys = branchMappings.map(m => m.docKey)

  if (docKeys.length === 0) {
    return NextResponse.json({
      items: [],
      totalCount: 0,
      page,
      pageSize: limit,
      totalPages: 0,
    })
  }

  // Step 2: Fetch details for these specific docKeys from AutoCount
  const detailsPromises = docKeys.map(docKey =>
    apiClient.getDeliveryOrderByDocKey(docKey)
  )

  const details = await Promise.all(detailsPromises)
  const items = details
    .filter(d => d.success && d.data)
    .map(d => d.data)

  // Step 3: Get total count for this branch
  const totalCount = await convex.query(
    api.deliveryOrderBranches.countByBranch,
    { branchId: branchId as Id<"branches"> }
  )

  return NextResponse.json({
    items,
    totalCount,
    page,
    pageSize: limit,
    totalPages: Math.ceil(totalCount / limit),
  })
}
```

4. **Add required Convex queries:**

```typescript
// File: website/convex/deliveryOrderBranches.ts
export const getPaginatedByBranch = query({
  args: {
    branchId: v.id("branches"),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deliveryOrderBranches")
      .withIndex("by_branch_and_date", (q) => q.eq("branchId", args.branchId))
      .order("desc")
      .collect()
      .then(items => items.slice(args.offset, args.offset + args.limit))
  },
})

export const countByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("deliveryOrderBranches")
      .withIndex("by_branch_id", (q) => q.eq("branchId", args.branchId))
      .collect()
    return items.length
  },
})
```

**Files to Update:**
- `website/convex/schema.ts` → Add compound index
- `website/convex/deliveryOrderBranches.ts` → Add pagination queries
- `website/app/api/autocount/delivery-orders-v2/route.ts` → Implement proper pagination
- `autocount-api/AutoCountApi/Controllers/DeliveryOrderController.cs` → Add GetByDocKey endpoint

**Deadline:** End of month
**Owner:** Backend team

---

### 2.3 Reliability: Add Request Deduplication

**Location:** All POST/PUT/DELETE API routes
**Risk Level:** HIGH
**Impact:** Duplicate transactions from rapid retries

**Action Steps:**

1. **Create idempotency middleware:**

```typescript
// File: website/lib/middleware/idempotency.ts
import { NextRequest, NextResponse } from 'next/server'

const requestCache = new Map<string, { response: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function withIdempotency(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Only apply to mutating operations
  const method = request.method
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    return handler(request)
  }

  // Check for idempotency key
  const idempotencyKey = request.headers.get('X-Idempotency-Key')
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'X-Idempotency-Key header required for mutating operations' },
      { status: 400 }
    )
  }

  // Check cache
  const cached = requestCache.get(idempotencyKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.response, {
      headers: { 'X-Idempotency-Replay': 'true' }
    })
  }

  // Execute request
  const response = await handler(request)
  const responseData = await response.json()

  // Cache successful responses
  if (response.status < 400) {
    requestCache.set(idempotencyKey, {
      response: responseData,
      timestamp: Date.now()
    })
  }

  // Cleanup old entries
  for (const [key, value] of requestCache.entries()) {
    if (Date.now() - value.timestamp > CACHE_TTL) {
      requestCache.delete(key)
    }
  }

  return NextResponse.json(responseData, { status: response.status })
}
```

2. **Update API routes:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/route.ts
import { withIdempotency } from '@/lib/middleware/idempotency'

export async function POST(request: NextRequest) {
  return withIdempotency(request, async (req) => {
    // Existing handler logic
    const { userId } = await auth()
    // ... rest of implementation
  })
}
```

3. **Update frontend to send idempotency keys:**

```typescript
// File: website/app/dashboard/delivery-orders/create/page.tsx
import { v4 as uuidv4 } from 'uuid'

async function createDeliveryOrder(data: any) {
  const idempotencyKey = uuidv4()

  const response = await fetch('/api/autocount/delivery-orders-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(data),
  })

  // Check if this was a replayed request
  const isReplay = response.headers.get('X-Idempotency-Replay') === 'true'
  if (isReplay) {
    console.log('Request was deduplicated (already processed)')
  }

  return response.json()
}
```

**Files to Create:**
- `website/lib/middleware/idempotency.ts` → Idempotency middleware
- `website/lib/hooks/useIdempotentMutation.ts` → React hook for client-side

**Files to Update:**
- `website/app/api/autocount/delivery-orders-v2/route.ts` → Apply middleware
- `website/app/api/autocount/customers/route.ts` → Apply middleware
- `website/app/api/autocount/products-v2/route.ts` → Apply middleware
- All create/update forms → Use idempotency keys

**Deadline:** End of month
**Owner:** Full-stack team

---

### 2.4 UX: Add React Error Boundaries

**Location:** Missing throughout application
**Risk Level:** HIGH
**Impact:** Component errors crash entire page, poor user experience

**Action Steps:**

1. **Create error boundary component:**

```typescript
// File: website/components/error-boundary.tsx
'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback

      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error!}
            reset={() => this.setState({ hasError: false, error: null })}
          />
        )
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground max-w-md">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

2. **Wrap critical components:**

```typescript
// File: website/app/dashboard/layout.tsx
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <ErrorBoundary>
        <ModernSidebar />
      </ErrorBoundary>
      <main className="flex-1">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
```

3. **Add specific fallbacks for data tables:**

```typescript
// File: website/components/data-table-error-fallback.tsx
export function DataTableErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="border rounded-lg p-8">
      <div className="text-center space-y-4">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <div>
          <h3 className="font-semibold">Failed to load data</h3>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={reset}>
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Files to Create:**
- `website/components/error-boundary.tsx` → Generic error boundary
- `website/components/data-table-error-fallback.tsx` → Table-specific fallback
- `website/components/form-error-fallback.tsx` → Form-specific fallback

**Files to Update:**
- `website/app/dashboard/layout.tsx` → Wrap layout sections
- `website/app/dashboard/delivery-orders/page.tsx` → Wrap data table
- `website/app/dashboard/customers/page.tsx` → Wrap data table
- All data-intensive pages → Add error boundaries

**Deadline:** End of month
**Owner:** Frontend team

---

## 🔶 PRIORITY 3: MEDIUM (Address Within 2 Months)

### 3.1 Architecture: Consolidate Stock Systems

**Issue:** Two parallel stock systems causing confusion
**Files:** `convex/stockKeeping.ts` (global) vs `convex/stockBalances.ts` (per-branch)

**Action Steps:**
1. Audit usage of both systems
2. Decide on single source of truth (recommend per-branch)
3. Create migration script
4. Update all references
5. Deprecate old system

**Deadline:** Q2 2026

---

### 3.2 Performance: Implement Caching Layer

**Issue:** Every request hits database, no caching
**Impact:** High latency, poor scalability

**Action Steps:**
1. Set up Redis instance (Azure Cache, AWS ElastiCache, or Upstash)
2. Implement cache-aside pattern for read operations
3. Add cache invalidation on updates
4. Cache frequently accessed data (customers, products)
5. Monitor cache hit ratio

**Deadline:** Q2 2026

---

### 3.3 Testing: Establish Test Coverage

**Issue:** Zero unit tests, no integration tests
**Target:** 80% code coverage for critical paths

**Action Steps:**
1. Set up Jest + React Testing Library
2. Write unit tests for services (target 80% coverage)
3. Write integration tests for API routes
4. Set up E2E tests with Playwright
5. Add pre-commit hook to run tests
6. Configure GitHub Actions for CI

**Deadline:** Q2 2026

---

### 3.4 API: Complete v2 Migration

**Issue:** Mix of v1 and v2 endpoints
**Impact:** Maintenance burden, inconsistency

**Action Steps:**
1. Audit all v1 endpoints still in use
2. Implement v2 equivalents
3. Update frontend to use v2 only
4. Add deprecation warnings to v1
5. Remove v1 endpoints after grace period

**Deadline:** Q2 2026

---

## 🎯 SUCCESS METRICS

Track these KPIs to measure progress:

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| **Security: Credentials in Git** | ❌ Yes | ✅ None | Week 1 |
| **Security: SQL Injection Risk** | ❌ Yes | ✅ None | Week 1 |
| **Data Integrity: Transaction Safety** | ❌ At Risk | ✅ Saga Pattern | Week 1 |
| **Concurrency: Race Condition Risk** | ❌ Yes | ✅ Optimistic Locking | Week 1 |
| **Type Safety: `any` Types** | ❌ 47 instances | ✅ Zero | Month 1 |
| **Testing: Code Coverage** | ❌ 0% | ✅ 80% | Quarter 1 |
| **Performance: API Response Time** | ⚠️ ~2s | ✅ <500ms | Quarter 1 |
| **Performance: Cache Hit Ratio** | ❌ 0% | ✅ >70% | Quarter 1 |
| **Reliability: Request Deduplication** | ❌ None | ✅ Implemented | Month 1 |

---

## 📅 SPRINT PLANNING

### Week 1 (Feb 11-17, 2026) - CRITICAL FIXES
- [ ] Rotate all exposed credentials
- [ ] Remove .env.local from git history
- [ ] Implement saga pattern for distributed transactions
- [ ] Add optimistic locking for stock adjustments
- [ ] Fix SQL injection vulnerabilities

### Week 2-4 (Feb 18 - Mar 10, 2026) - HIGH PRIORITY
- [ ] Remove all `any` types, enable strict TypeScript
- [ ] Implement server-side branch filtering with pagination
- [ ] Add request deduplication middleware
- [ ] Implement React error boundaries
- [ ] Set up unit testing framework

### Month 2 (March 2026) - STABILIZATION
- [ ] Write unit tests for critical services (80% coverage)
- [ ] Add integration tests for API routes
- [ ] Implement Redis caching for read operations
- [ ] Set up monitoring and alerting
- [ ] Complete security audit

### Q2 2026 - OPTIMIZATION
- [ ] Complete API v2 migration
- [ ] Consolidate to single stock system
- [ ] Implement E2E testing with Playwright
- [ ] Performance optimization (target <500ms response times)
- [ ] Documentation improvements

---

## 🚀 GETTING STARTED

### Immediate Actions (Today)

1. **Backup Everything**
   ```bash
   # Create backup branch
   git checkout -b backup-before-fixes
   git push origin backup-before-fixes

   # Export database
   # Backup AutoCount database before making changes
   ```

2. **Rotate Credentials**
   - Clerk: https://dashboard.clerk.com (API Keys → Regenerate)
   - Convex: https://dashboard.convex.dev (Settings → Deploy Keys)
   - SQL Server: Change `sa` password via SSMS
   - Generate new AutoCount API key: `[System.Web.Security.Membership]::GeneratePassword(32, 8)`

3. **Create Feature Branch**
   ```bash
   git checkout -b fix/critical-security-issues
   ```

4. **Start with Security Fixes**
   Follow sections 1.1 (Credentials) and 1.4 (SQL Injection) first.

---

## 📞 SUPPORT & QUESTIONS

- **Documentation:** See CLAUDE.md for architecture details
- **Issue Tracking:** Create GitHub issues for each fix
- **Code Review:** Require approval from 2+ team members for security fixes
- **Testing:** Test all changes in development environment first

---

## 🔄 REVIEW SCHEDULE

- **Daily Standups:** Track progress on critical fixes
- **Weekly Reviews:** Assess completion of high-priority items
- **Monthly Retrospective:** Evaluate what's working, adjust approach
- **Quarterly Audit:** Security and performance review

---

**Document Version:** 1.0
**Last Updated:** 2026-02-11
**Next Review:** 2026-02-18 (after critical fixes complete)
