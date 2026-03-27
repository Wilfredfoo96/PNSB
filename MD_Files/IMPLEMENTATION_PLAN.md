# PNSB Project: Implementation Plan & Testing Strategy

**Generated:** 2026-02-11
**Purpose:** Step-by-step implementation guide for all fixes identified in FIXES_REQUIRED.md
**Scope:** All fixes except 1.1 (Credentials - handled separately)
**Estimated Duration:** 8 weeks (2 weeks critical, 4 weeks high priority, 2 weeks medium priority)

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Phase 1: Critical Fixes (Week 1-2)](#phase-1-critical-fixes-week-1-2)
3. [Phase 2: High Priority (Week 3-6)](#phase-2-high-priority-week-3-6)
4. [Phase 3: Medium Priority (Week 7-8)](#phase-3-medium-priority-week-7-8)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plans](#rollback-plans)
7. [Success Criteria](#success-criteria)

---

## Implementation Overview

### Dependency Graph

```
Phase 1 (Critical - Week 1-2)
├── 1.2 Distributed Transactions (Saga Pattern)
│   └── Required for: Stock deduction safety
├── 1.3 Race Conditions (Optimistic Locking)
│   └── Required for: Concurrent stock operations
└── 1.4 SQL Injection (Parameterized Queries)
    └── Required for: Production security

Phase 2 (High Priority - Week 3-6)
├── 2.1 Type Safety (Remove any types)
│   └── Enables: Better IDE support, fewer runtime errors
├── 2.2 Branch Filtering (Server-side pagination)
│   └── Depends on: 1.3 (optimistic locking for Convex queries)
├── 2.3 Request Deduplication (Idempotency)
│   └── Depends on: 1.2 (saga pattern for rollback)
└── 2.4 Error Boundaries (UX)
    └── Independent

Phase 3 (Medium Priority - Week 7-8)
├── 3.1 Stock System Consolidation
│   └── Depends on: 1.3, 2.2
├── 3.2 Caching Layer (Redis)
│   └── Depends on: 2.2 (efficient queries first)
├── 3.3 Test Coverage (80% target)
│   └── Should test: All Phase 1 & 2 fixes
└── 3.4 API v2 Migration
    └── Depends on: 2.1 (type safety)
```

### Team Allocation

| Phase | Focus Area | Team Members | Duration |
|-------|------------|--------------|----------|
| Phase 1 | Critical Fixes | 2 Backend + 1 Full-stack | 2 weeks |
| Phase 2 | High Priority | 2 Full-stack + 1 Frontend | 4 weeks |
| Phase 3 | Medium Priority | 1 Backend + 1 DevOps + 1 QA | 2 weeks |

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.2 Distributed Transactions: Implement Saga Pattern

**Objective:** Ensure stock deduction and DO creation are atomic operations with proper rollback.

#### Step 1: Create Saga Coordinator Infrastructure

**Timeline:** Day 1-2
**Owner:** Backend Lead

**Implementation:**

1. **Create saga coordinator class:**

```typescript
// File: website/lib/transaction/saga-coordinator.ts
export interface TransactionStep {
  name: string
  execute: () => Promise<void>
  compensate: () => Promise<void>
}

export class SagaCoordinator {
  private steps: TransactionStep[] = []
  private executedSteps: TransactionStep[] = []
  private logs: string[] = []

  addStep(step: TransactionStep): void {
    this.steps.push(step)
  }

  async execute(): Promise<{ success: boolean; error?: string; logs: string[] }> {
    this.logs = []
    this.executedSteps = []

    try {
      for (const step of this.steps) {
        this.log(`Executing step: ${step.name}`)
        await step.execute()
        this.executedSteps.push(step)
        this.log(`✓ Step completed: ${step.name}`)
      }

      this.log('✓ Saga completed successfully')
      return { success: true, logs: this.logs }
    } catch (error) {
      this.log(`✗ Saga failed at step: ${this.executedSteps.length}`)
      await this.rollback()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: this.logs
      }
    }
  }

  private async rollback(): Promise<void> {
    this.log('Starting rollback...')

    // Compensate in reverse order
    for (let i = this.executedSteps.length - 1; i >= 0; i--) {
      const step = this.executedSteps[i]
      try {
        this.log(`Compensating step: ${step.name}`)
        await step.compensate()
        this.log(`✓ Compensation completed: ${step.name}`)
      } catch (compensateError) {
        this.log(`✗ Compensation failed: ${step.name}`)
        console.error('CRITICAL: Compensation failed', {
          step: step.name,
          error: compensateError
        })
        // Log to monitoring service (Sentry, etc.)
      }
    }

    this.log('Rollback completed')
  }

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`)
    console.log(message)
  }
}
```

**Testing:**

```typescript
// File: website/lib/transaction/__tests__/saga-coordinator.test.ts
import { SagaCoordinator } from '../saga-coordinator'

describe('SagaCoordinator', () => {
  it('should execute all steps successfully', async () => {
    const saga = new SagaCoordinator()
    const results: string[] = []

    saga.addStep({
      name: 'Step 1',
      execute: async () => { results.push('step1-execute') },
      compensate: async () => { results.push('step1-compensate') }
    })

    saga.addStep({
      name: 'Step 2',
      execute: async () => { results.push('step2-execute') },
      compensate: async () => { results.push('step2-compensate') }
    })

    const result = await saga.execute()

    expect(result.success).toBe(true)
    expect(results).toEqual(['step1-execute', 'step2-execute'])
  })

  it('should rollback on failure', async () => {
    const saga = new SagaCoordinator()
    const results: string[] = []

    saga.addStep({
      name: 'Step 1',
      execute: async () => { results.push('step1-execute') },
      compensate: async () => { results.push('step1-compensate') }
    })

    saga.addStep({
      name: 'Step 2 (fails)',
      execute: async () => { throw new Error('Step 2 failed') },
      compensate: async () => { results.push('step2-compensate') }
    })

    saga.addStep({
      name: 'Step 3',
      execute: async () => { results.push('step3-execute') },
      compensate: async () => { results.push('step3-compensate') }
    })

    const result = await saga.execute()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Step 2 failed')
    expect(results).toEqual([
      'step1-execute',
      'step1-compensate' // Rollback in reverse order
    ])
  })

  it('should log compensation failures but continue rollback', async () => {
    const saga = new SagaCoordinator()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    saga.addStep({
      name: 'Step 1',
      execute: async () => {},
      compensate: async () => { throw new Error('Compensate failed') }
    })

    saga.addStep({
      name: 'Step 2',
      execute: async () => { throw new Error('Execute failed') },
      compensate: async () => {}
    })

    const result = await saga.execute()

    expect(result.success).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      'CRITICAL: Compensation failed',
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })
})
```

**Manual Test:**
1. Run unit tests: `npm test saga-coordinator.test.ts`
2. Verify all tests pass
3. Review console logs for proper formatting

---

#### Step 2: Apply Saga to Delivery Order Creation

**Timeline:** Day 3-4
**Owner:** Full-stack Developer

**Implementation:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/route.ts
import { SagaCoordinator } from '@/lib/transaction/saga-coordinator'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsedBody = DeliveryOrderCreateSchema.parse(body)

    // Initialize clients
    const apiClient = getAutoCountApiClient()
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

    // Initialize saga
    const saga = new SagaCoordinator()
    let docKey: string | undefined
    let createdDO: any = null

    // Step 1: Create Delivery Order in AutoCount
    saga.addStep({
      name: 'Create AutoCount Delivery Order',
      execute: async () => {
        const createRequest = {
          debtorCode: parsedBody.debtorCode,
          description: parsedBody.description,
          detail: parsedBody.detail.map(item => ({
            itemCode: item.itemCode,
            qty: item.qty,
            unitPrice: item.unitPrice,
            description: item.description,
          })),
        }

        const response = await apiClient.createDraftDeliveryOrder(createRequest)

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to create delivery order')
        }

        docKey = response.data.docKey
        createdDO = response.data
      },
      compensate: async () => {
        if (docKey) {
          console.log(`Voiding delivery order: ${docKey}`)
          await apiClient.voidDeliveryOrder(docKey)
        }
      }
    })

    // Step 2: Deduct stock from Convex
    saga.addStep({
      name: 'Deduct Stock from Inventory',
      execute: async () => {
        if (!docKey) throw new Error('DocKey not available')

        for (const item of parsedBody.detail) {
          await convex.mutation(api.stockKeeping.adjustStockAndLog, {
            itemCode: item.itemCode,
            quantity: -item.qty,
            reason: 'Sales',
            docKey: docKey,
          })
        }
      },
      compensate: async () => {
        if (!docKey) return

        // Reverse stock deductions
        console.log(`Reversing stock deductions for DO: ${docKey}`)
        for (const item of parsedBody.detail) {
          await convex.mutation(api.stockKeeping.adjustStockAndLog, {
            itemCode: item.itemCode,
            quantity: item.qty,
            reason: 'Sales Reversal',
            docKey: docKey,
          })
        }
      }
    })

    // Step 3: Create branch mapping (if branchId provided)
    if (parsedBody.branchId) {
      saga.addStep({
        name: 'Create Branch Mapping',
        execute: async () => {
          if (!docKey) throw new Error('DocKey not available')

          await convex.mutation(api.deliveryOrderBranches.create, {
            docKey: docKey,
            branchId: parsedBody.branchId as Id<"branches">,
          })
        },
        compensate: async () => {
          if (!docKey) return

          // Delete branch mapping
          console.log(`Deleting branch mapping for DO: ${docKey}`)
          await convex.mutation(api.deliveryOrderBranches.deleteByDocKey, {
            docKey: docKey
          })
        }
      })
    }

    // Execute saga
    const result = await saga.execute()

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        logs: result.logs,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: createdDO,
      logs: result.logs,
    })

  } catch (error) {
    console.error('Error in delivery order creation:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
```

**Testing:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/__tests__/route.test.ts
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@clerk/nextjs/server')
jest.mock('@/lib/autocount-api-client-instance')
jest.mock('convex/browser')

describe('POST /api/autocount/delivery-orders-v2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create DO and deduct stock successfully', async () => {
    // Setup mocks
    const mockAuth = require('@clerk/nextjs/server').auth
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    const mockApiClient = {
      createDraftDeliveryOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { docKey: 'DO-001', docNo: 'DO-001' }
      }),
      voidDeliveryOrder: jest.fn()
    }
    require('@/lib/autocount-api-client-instance').getAutoCountApiClient
      .mockReturnValue(mockApiClient)

    const mockConvex = {
      mutation: jest.fn().mockResolvedValue(undefined)
    }
    require('convex/browser').ConvexHttpClient.mockImplementation(() => mockConvex)

    // Make request
    const request = new NextRequest('http://localhost/api/autocount/delivery-orders-v2', {
      method: 'POST',
      body: JSON.stringify({
        debtorCode: 'C001',
        description: 'Test DO',
        detail: [
          { itemCode: 'ITEM001', qty: 10, unitPrice: 100 }
        ]
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockApiClient.createDraftDeliveryOrder).toHaveBeenCalledTimes(1)
    expect(mockConvex.mutation).toHaveBeenCalledTimes(1)
    expect(mockApiClient.voidDeliveryOrder).not.toHaveBeenCalled()
  })

  it('should rollback DO when stock deduction fails', async () => {
    // Setup mocks
    const mockAuth = require('@clerk/nextjs/server').auth
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    const mockApiClient = {
      createDraftDeliveryOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { docKey: 'DO-002', docNo: 'DO-002' }
      }),
      voidDeliveryOrder: jest.fn().mockResolvedValue({ success: true })
    }
    require('@/lib/autocount-api-client-instance').getAutoCountApiClient
      .mockReturnValue(mockApiClient)

    const mockConvex = {
      mutation: jest.fn()
        .mockRejectedValueOnce(new Error('Insufficient stock')) // Fail stock deduction
    }
    require('convex/browser').ConvexHttpClient.mockImplementation(() => mockConvex)

    // Make request
    const request = new NextRequest('http://localhost/api/autocount/delivery-orders-v2', {
      method: 'POST',
      body: JSON.stringify({
        debtorCode: 'C001',
        description: 'Test DO',
        detail: [
          { itemCode: 'ITEM001', qty: 10, unitPrice: 100 }
        ]
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBeUndefined()
    expect(mockApiClient.createDraftDeliveryOrder).toHaveBeenCalledTimes(1)
    expect(mockApiClient.voidDeliveryOrder).toHaveBeenCalledWith('DO-002') // Rollback occurred
  })
})
```

**Manual Test:**
1. **Success scenario:**
   - Navigate to delivery order creation page
   - Fill in valid customer and items with available stock
   - Submit form
   - Verify DO created in AutoCount
   - Verify stock deducted in Convex
   - Verify branch mapping created (if applicable)

2. **Failure scenario (insufficient stock):**
   - Create DO with item quantity > available stock
   - Submit form
   - Verify error message shown
   - Verify NO DO exists in AutoCount (rolled back)
   - Verify stock unchanged in Convex

3. **Failure scenario (network timeout):**
   - Use browser dev tools to throttle network to "Slow 3G"
   - Create DO and trigger timeout during stock deduction
   - Verify DO voided in AutoCount
   - Verify stock unchanged in Convex

---

### 1.3 Race Conditions: Implement Optimistic Locking

**Objective:** Prevent inventory loss from concurrent stock adjustments.

#### Step 1: Update Convex Schema

**Timeline:** Day 5
**Owner:** Backend Lead

**Implementation:**

```typescript
// File: website/convex/schema.ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // ... existing tables ...

  stockKeeping: defineTable({
    itemCode: v.string(),
    quantity: v.number(),
    version: v.number(), // NEW: For optimistic locking
    lastUpdated: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_item_code", ["itemCode"]),

  stockBalances: defineTable({
    branchId: v.id("branches"),
    itemCode: v.string(),
    quantity: v.number(),
    version: v.number(), // NEW: For optimistic locking
    lastUpdated: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_branch_and_item", ["branchId", "itemCode"])
    .index("by_item_code", ["itemCode"]),

  stockMovementLogs: defineTable({
    itemCode: v.string(),
    branchId: v.optional(v.id("branches")),
    quantityChange: v.number(),
    previousQuantity: v.number(),
    newQuantity: v.number(),
    previousVersion: v.number(), // NEW: Track version changes
    newVersion: v.number(),
    reason: v.string(),
    docKey: v.optional(v.string()),
    timestamp: v.number(),
    userId: v.string(),
  })
    .index("by_item_code", ["itemCode"])
    .index("by_doc_key", ["docKey"])
    .index("by_timestamp", ["timestamp"]),
})
```

**Migration Script:**

```typescript
// File: website/convex/migrations/add_version_to_stock.ts
import { mutation } from "./_generated/server"

export const addVersionToStockKeeping = mutation({
  handler: async (ctx) => {
    const items = await ctx.db.query("stockKeeping").collect()

    let updated = 0
    for (const item of items) {
      if (item.version === undefined) {
        await ctx.db.patch(item._id, {
          version: 1,
          lastUpdated: Date.now(),
        })
        updated++
      }
    }

    return { updated, total: items.length }
  }
})

export const addVersionToStockBalances = mutation({
  handler: async (ctx) => {
    const items = await ctx.db.query("stockBalances").collect()

    let updated = 0
    for (const item of items) {
      if (item.version === undefined) {
        await ctx.db.patch(item._id, {
          version: 1,
          lastUpdated: Date.now(),
        })
        updated++
      }
    }

    return { updated, total: items.length }
  }
})
```

**Testing:**
```bash
# Deploy schema changes
cd website
npm run convex:dev

# In Convex dashboard, run migrations
# Navigate to: https://dashboard.convex.dev/[your-deployment]/functions
# Execute: addVersionToStockKeeping
# Execute: addVersionToStockBalances

# Verify results
# All stock records should now have version: 1
```

---

#### Step 2: Implement Optimistic Locking in Mutations

**Timeline:** Day 6-7
**Owner:** Backend Developer

**Implementation:**

```typescript
// File: website/convex/stockKeeping.ts
import { v } from "convex/values"
import { mutation } from "./_generated/server"

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

    const MAX_RETRIES = 5
    const BASE_DELAY_MS = 50

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // 1. Read current state
        const current = await ctx.db
          .query("stockKeeping")
          .withIndex("by_item_code", (q) => q.eq("itemCode", args.itemCode))
          .first()

        if (!current) {
          throw new Error(`Item ${args.itemCode} not found in stock keeping`)
        }

        const currentVersion = current.version || 1
        const newQuantity = current.quantity + args.quantity

        // 2. Validate stock availability
        if (newQuantity < 0) {
          throw new Error(
            `Insufficient stock for ${args.itemCode}. ` +
            `Available: ${current.quantity}, Requested: ${Math.abs(args.quantity)}`
          )
        }

        // 3. Attempt optimistic update
        await ctx.db.patch(current._id, {
          quantity: newQuantity,
          version: currentVersion + 1,
          lastUpdated: Date.now(),
          updatedBy: identity.subject,
        })

        // 4. Verify update succeeded (version check)
        const updated = await ctx.db.get(current._id)

        if (!updated) {
          throw new Error("Record was deleted during update")
        }

        if (updated.version !== currentVersion + 1) {
          // Version mismatch - another transaction modified the record
          console.log(`Optimistic lock conflict on attempt ${attempt + 1} for ${args.itemCode}`)

          if (attempt < MAX_RETRIES - 1) {
            // Exponential backoff
            const delay = BASE_DELAY_MS * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue // Retry
          }

          throw new Error(`Stock adjustment failed after ${MAX_RETRIES} retries due to conflicts`)
        }

        // 5. Log the movement
        await ctx.db.insert("stockMovementLogs", {
          itemCode: args.itemCode,
          quantityChange: args.quantity,
          previousQuantity: current.quantity,
          newQuantity: newQuantity,
          previousVersion: currentVersion,
          newVersion: currentVersion + 1,
          reason: args.reason,
          docKey: args.docKey,
          timestamp: Date.now(),
          userId: identity.subject,
        })

        return {
          success: true,
          newQuantity,
          newVersion: currentVersion + 1,
          attempts: attempt + 1,
        }

      } catch (error) {
        // If validation error or max retries, throw
        if (error instanceof Error && (
          error.message.includes('Insufficient stock') ||
          error.message.includes('not found') ||
          attempt >= MAX_RETRIES - 1
        )) {
          throw error
        }

        // Otherwise retry
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error(`Stock adjustment failed after ${MAX_RETRIES} retries`)
  },
})

// Similar implementation for stockBalances
export const adjustBranchStockAndLog = mutation({
  args: {
    branchId: v.id("branches"),
    itemCode: v.string(),
    quantity: v.number(),
    reason: v.string(),
    docKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const MAX_RETRIES = 5
    const BASE_DELAY_MS = 50

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // 1. Read current state
        const current = await ctx.db
          .query("stockBalances")
          .withIndex("by_branch_and_item", (q) =>
            q.eq("branchId", args.branchId).eq("itemCode", args.itemCode)
          )
          .first()

        if (!current) {
          throw new Error(
            `Item ${args.itemCode} not found in branch ${args.branchId} stock`
          )
        }

        const currentVersion = current.version || 1
        const newQuantity = current.quantity + args.quantity

        // 2. Validate stock availability
        if (newQuantity < 0) {
          throw new Error(
            `Insufficient stock for ${args.itemCode} in this branch. ` +
            `Available: ${current.quantity}, Requested: ${Math.abs(args.quantity)}`
          )
        }

        // 3. Attempt optimistic update
        await ctx.db.patch(current._id, {
          quantity: newQuantity,
          version: currentVersion + 1,
          lastUpdated: Date.now(),
          updatedBy: identity.subject,
        })

        // 4. Verify update succeeded
        const updated = await ctx.db.get(current._id)

        if (!updated || updated.version !== currentVersion + 1) {
          console.log(`Optimistic lock conflict on attempt ${attempt + 1}`)

          if (attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }

          throw new Error(`Stock adjustment failed after ${MAX_RETRIES} retries`)
        }

        // 5. Log the movement
        await ctx.db.insert("stockMovementLogs", {
          itemCode: args.itemCode,
          branchId: args.branchId,
          quantityChange: args.quantity,
          previousQuantity: current.quantity,
          newQuantity: newQuantity,
          previousVersion: currentVersion,
          newVersion: currentVersion + 1,
          reason: args.reason,
          docKey: args.docKey,
          timestamp: Date.now(),
          userId: identity.subject,
        })

        return {
          success: true,
          newQuantity,
          newVersion: currentVersion + 1,
          attempts: attempt + 1,
        }

      } catch (error) {
        if (error instanceof Error && (
          error.message.includes('Insufficient stock') ||
          error.message.includes('not found') ||
          attempt >= MAX_RETRIES - 1
        )) {
          throw error
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error(`Stock adjustment failed after ${MAX_RETRIES} retries`)
  },
})
```

**Testing:**

```typescript
// File: website/convex/__tests__/stockKeeping.test.ts
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import schema from "../schema"
import { adjustStockAndLog } from "../stockKeeping"

test("concurrent stock adjustments should not lose inventory", async () => {
  const t = convexTest(schema)

  // Setup: Create initial stock
  await t.run(async (ctx) => {
    await ctx.db.insert("stockKeeping", {
      itemCode: "TEST001",
      quantity: 100,
      version: 1,
      lastUpdated: Date.now(),
    })
  })

  // Simulate 10 concurrent deductions of 5 units each
  const adjustments = Array.from({ length: 10 }, (_, i) =>
    t.mutation(adjustStockAndLog, {
      itemCode: "TEST001",
      quantity: -5,
      reason: `Test deduction ${i}`,
    })
  )

  // Execute all concurrently
  const results = await Promise.all(adjustments)

  // Verify all succeeded
  expect(results.every(r => r.success)).toBe(true)

  // Verify final quantity is correct (100 - 50 = 50)
  const final = await t.run(async (ctx) => {
    return await ctx.db
      .query("stockKeeping")
      .withIndex("by_item_code", (q) => q.eq("itemCode", "TEST001"))
      .first()
  })

  expect(final?.quantity).toBe(50)
  expect(final?.version).toBe(11) // 1 + 10 adjustments

  // Verify all movements logged
  const logs = await t.run(async (ctx) => {
    return await ctx.db
      .query("stockMovementLogs")
      .withIndex("by_item_code", (q) => q.eq("itemCode", "TEST001"))
      .collect()
  })

  expect(logs).toHaveLength(10)

  // Verify sum of changes equals total deduction
  const totalChange = logs.reduce((sum, log) => sum + log.quantityChange, 0)
  expect(totalChange).toBe(-50)
})

test("should prevent overselling", async () => {
  const t = convexTest(schema)

  // Setup: Create stock with only 10 units
  await t.run(async (ctx) => {
    await ctx.db.insert("stockKeeping", {
      itemCode: "TEST002",
      quantity: 10,
      version: 1,
      lastUpdated: Date.now(),
    })
  })

  // Try to deduct 15 units (should fail)
  await expect(async () => {
    await t.mutation(adjustStockAndLog, {
      itemCode: "TEST002",
      quantity: -15,
      reason: "Test overselling",
    })
  }).rejects.toThrow("Insufficient stock")

  // Verify quantity unchanged
  const final = await t.run(async (ctx) => {
    return await ctx.db
      .query("stockKeeping")
      .withIndex("by_item_code", (q) => q.eq("itemCode", "TEST002"))
      .first()
  })

  expect(final?.quantity).toBe(10)
  expect(final?.version).toBe(1) // No change
})
```

**Load Test:**

```typescript
// File: scripts/load-test-stock-concurrency.ts
import { ConvexHttpClient } from "convex/browser"
import { api } from "../website/convex/_generated/api"

async function runLoadTest() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  // Setup: Create test item with 1000 units
  console.log("Setting up test data...")
  await convex.mutation(api.stockKeeping.create, {
    itemCode: "LOAD_TEST_001",
    quantity: 1000,
  })

  // Run 100 concurrent deductions of 5 units each
  console.log("Running 100 concurrent stock adjustments...")
  const startTime = Date.now()

  const promises = Array.from({ length: 100 }, (_, i) =>
    convex.mutation(api.stockKeeping.adjustStockAndLog, {
      itemCode: "LOAD_TEST_001",
      quantity: -5,
      reason: `Load test ${i}`,
    })
  )

  const results = await Promise.all(promises)
  const endTime = Date.now()

  // Verify results
  const finalStock = await convex.query(api.stockKeeping.getByItemCode, {
    itemCode: "LOAD_TEST_001"
  })

  console.log("\nLoad Test Results:")
  console.log("==================")
  console.log(`Duration: ${endTime - startTime}ms`)
  console.log(`Successful adjustments: ${results.filter(r => r.success).length}/100`)
  console.log(`Expected final quantity: 500`)
  console.log(`Actual final quantity: ${finalStock?.quantity}`)
  console.log(`Final version: ${finalStock?.version}`)
  console.log(`Average retries: ${results.reduce((sum, r) => sum + r.attempts, 0) / results.length}`)

  // Assertions
  if (finalStock?.quantity !== 500) {
    throw new Error("FAILED: Inventory loss detected!")
  }

  if (results.some(r => !r.success)) {
    throw new Error("FAILED: Some adjustments did not succeed")
  }

  console.log("\n✓ Load test PASSED")
}

runLoadTest().catch(console.error)
```

**Run load test:**
```bash
cd website
npx tsx ../scripts/load-test-stock-concurrency.ts
```

**Expected output:**
```
Load Test Results:
==================
Duration: 2341ms
Successful adjustments: 100/100
Expected final quantity: 500
Actual final quantity: 500
Final version: 101
Average retries: 1.23

✓ Load test PASSED
```

---

### 1.4 SQL Injection: Refactor to Parameterized Queries

**Objective:** Eliminate SQL injection vulnerabilities in AutoCount API.

#### Step 1: Create Query Builder Helper

**Timeline:** Day 8
**Owner:** Backend Lead

**Implementation:**

```csharp
// File: autocount-api/AutoCountApi/Helpers/QueryBuilder.cs
using Dapper;
using System.Collections.Generic;
using System.Linq;

namespace AutoCountApi.Helpers
{
    public class QueryBuilder
    {
        private readonly List<string> _whereConditions = new();
        private readonly DynamicParameters _parameters = new();

        public void AddCondition(string condition, object value, string paramName)
        {
            _whereConditions.Add(condition);
            _parameters.Add(paramName, value);
        }

        public void AddInCondition<T>(string columnName, IEnumerable<T> values, string paramName)
        {
            if (values == null || !values.Any())
            {
                return;
            }

            var paramNames = values.Select((_, i) => $"@{paramName}{i}").ToList();
            _whereConditions.Add($"{columnName} IN ({string.Join(", ", paramNames)})");

            var valuesList = values.ToList();
            for (int i = 0; i < valuesList.Count; i++)
            {
                _parameters.Add($"{paramName}{i}", valuesList[i]);
            }
        }

        public string GetWhereClause()
        {
            return _whereConditions.Count > 0
                ? "WHERE " + string.Join(" AND ", _whereConditions)
                : "";
        }

        public DynamicParameters GetParameters()
        {
            return _parameters;
        }

        public void AddPagination(int page, int pageSize)
        {
            _parameters.Add("Offset", (page - 1) * pageSize);
            _parameters.Add("PageSize", pageSize);
        }
    }

    public enum DeliveryOrderStatus
    {
        Draft,
        Posted,
        Void
    }

    public static class StatusHelper
    {
        public static DeliveryOrderStatus ParseStatus(string status)
        {
            return status?.ToUpper() switch
            {
                "DRAFT" => DeliveryOrderStatus.Draft,
                "POSTED" => DeliveryOrderStatus.Posted,
                "VOID" => DeliveryOrderStatus.Void,
                _ => throw new ArgumentException($"Invalid status: {status}")
            };
        }

        public static (string CancelledValue, string TransferredValue) GetStatusValues(DeliveryOrderStatus status)
        {
            return status switch
            {
                DeliveryOrderStatus.Draft => ("F", "F"),
                DeliveryOrderStatus.Posted => ("F", "T"),
                DeliveryOrderStatus.Void => ("T", null),
                _ => throw new ArgumentException($"Invalid status: {status}")
            };
        }
    }
}
```

**Testing:**

```csharp
// File: autocount-api/AutoCountApi.Tests/Helpers/QueryBuilderTests.cs
using Xunit;
using AutoCountApi.Helpers;

namespace AutoCountApi.Tests.Helpers
{
    public class QueryBuilderTests
    {
        [Fact]
        public void AddCondition_ShouldAddWhereClause()
        {
            var builder = new QueryBuilder();
            builder.AddCondition("Name = @Name", "John", "Name");

            var whereClause = builder.GetWhereClause();
            var parameters = builder.GetParameters();

            Assert.Equal("WHERE Name = @Name", whereClause);
            Assert.Equal("John", parameters.Get<string>("Name"));
        }

        [Fact]
        public void AddInCondition_ShouldHandleMultipleValues()
        {
            var builder = new QueryBuilder();
            var ids = new[] { 1, 2, 3 };
            builder.AddInCondition("Id", ids, "Id");

            var whereClause = builder.GetWhereClause();
            var parameters = builder.GetParameters();

            Assert.Equal("WHERE Id IN (@Id0, @Id1, @Id2)", whereClause);
            Assert.Equal(1, parameters.Get<int>("Id0"));
            Assert.Equal(2, parameters.Get<int>("Id1"));
            Assert.Equal(3, parameters.Get<int>("Id2"));
        }

        [Fact]
        public void ParseStatus_ShouldThrowOnInvalidInput()
        {
            Assert.Throws<ArgumentException>(() =>
                StatusHelper.ParseStatus("'; DROP TABLE ARDeliveryOrder; --")
            );
        }

        [Theory]
        [InlineData("DRAFT", "F", "F")]
        [InlineData("POSTED", "F", "T")]
        [InlineData("VOID", "T", null)]
        public void GetStatusValues_ShouldReturnCorrectValues(
            string statusStr,
            string expectedCancelled,
            string expectedTransferred)
        {
            var status = StatusHelper.ParseStatus(statusStr);
            var (cancelled, transferred) = StatusHelper.GetStatusValues(status);

            Assert.Equal(expectedCancelled, cancelled);
            Assert.Equal(expectedTransferred, transferred);
        }
    }
}
```

---

#### Step 2: Refactor DeliveryOrderService

**Timeline:** Day 9
**Owner:** Backend Developer

**Implementation:**

```csharp
// File: autocount-api/AutoCountApi/Services/DeliveryOrderService.cs
using AutoCountApi.Helpers;
using AutoCountApi.Models;
using Dapper;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AutoCountApi.Services
{
    public class DeliveryOrderService : IDeliveryOrderService
    {
        private readonly IAutoCountDbService _dbService;
        private readonly ILogger<DeliveryOrderService> _logger;

        public DeliveryOrderService(
            IAutoCountDbService dbService,
            ILogger<DeliveryOrderService> logger)
        {
            _dbService = dbService;
            _logger = logger;
        }

        public async Task<(List<DeliveryOrderDto> Items, int TotalCount)> GetDeliveryOrders(
            int page,
            int pageSize,
            string? status = null,
            string? debtorCode = null,
            DateTime? fromDate = null,
            DateTime? toDate = null)
        {
            try
            {
                using var connection = await _dbService.GetConnectionAsync();

                var builder = new QueryBuilder();

                // Status filter
                if (!string.IsNullOrEmpty(status))
                {
                    var parsedStatus = StatusHelper.ParseStatus(status);
                    var (cancelledValue, transferredValue) = StatusHelper.GetStatusValues(parsedStatus);

                    if (parsedStatus == DeliveryOrderStatus.Void)
                    {
                        builder.AddCondition("do.Cancelled = @Cancelled", cancelledValue, "Cancelled");
                    }
                    else
                    {
                        builder.AddCondition("do.Cancelled = @Cancelled", cancelledValue, "Cancelled");
                        builder.AddCondition("do.Transferred = @Transferred", transferredValue, "Transferred");
                    }
                }

                // Debtor filter
                if (!string.IsNullOrEmpty(debtorCode))
                {
                    builder.AddCondition("do.DebtorCode = @DebtorCode", debtorCode, "DebtorCode");
                }

                // Date range filter
                if (fromDate.HasValue)
                {
                    builder.AddCondition("do.DocDate >= @FromDate", fromDate.Value, "FromDate");
                }

                if (toDate.HasValue)
                {
                    builder.AddCondition("do.DocDate <= @ToDate", toDate.Value, "ToDate");
                }

                string whereClause = builder.GetWhereClause();
                var parameters = builder.GetParameters();

                // Count query
                string countQuery = $@"
                    SELECT COUNT(*)
                    FROM ARDeliveryOrder do
                    {whereClause}";

                int totalCount = await connection.ExecuteScalarAsync<int>(countQuery, parameters);

                // Pagination
                builder.AddPagination(page, pageSize);

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
                _logger.LogError(ex, "Error retrieving delivery orders with filters: status={Status}, debtorCode={DebtorCode}", status, debtorCode);
                throw;
            }
        }

        public async Task<DeliveryOrderDto?> GetDeliveryOrderByDocKey(string docKey)
        {
            try
            {
                using var connection = await _dbService.GetConnectionAsync();

                var builder = new QueryBuilder();
                builder.AddCondition("do.DocKey = @DocKey", docKey, "DocKey");

                string whereClause = builder.GetWhereClause();
                var parameters = builder.GetParameters();

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
                    {whereClause}";

                var result = await connection.QueryFirstOrDefaultAsync<DeliveryOrderDto>(query, parameters);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving delivery order by DocKey: {DocKey}", docKey);
                throw;
            }
        }

        public async Task<List<DeliveryOrderDetailDto>> GetDeliveryOrderDetails(string docKey)
        {
            try
            {
                using var connection = await _dbService.GetConnectionAsync();

                var builder = new QueryBuilder();
                builder.AddCondition("dtl.DocKey = @DocKey", docKey, "DocKey");

                string whereClause = builder.GetWhereClause();
                var parameters = builder.GetParameters();

                string query = $@"
                    SELECT
                        dtl.DtlKey,
                        dtl.DocKey,
                        dtl.Seq,
                        dtl.ItemCode,
                        i.Description AS ItemDescription,
                        dtl.Qty,
                        dtl.UnitPrice,
                        dtl.Amount,
                        dtl.Description
                    FROM ARDeliveryOrderDtl dtl
                    LEFT JOIN Item i ON dtl.ItemCode = i.ItemCode
                    {whereClause}
                    ORDER BY dtl.Seq";

                var items = await connection.QueryAsync<DeliveryOrderDetailDto>(query, parameters);

                return items.ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving delivery order details for DocKey: {DocKey}", docKey);
                throw;
            }
        }
    }
}
```

**Testing:**

```csharp
// File: autocount-api/AutoCountApi.Tests/Services/DeliveryOrderServiceTests.cs
using Xunit;
using Moq;
using AutoCountApi.Services;
using AutoCountApi.Helpers;
using System.Data;

namespace AutoCountApi.Tests.Services
{
    public class DeliveryOrderServiceTests
    {
        [Fact]
        public async Task GetDeliveryOrders_WithValidStatus_ShouldNotThrow()
        {
            var mockDb = new Mock<IAutoCountDbService>();
            var mockLogger = new Mock<ILogger<DeliveryOrderService>>();
            var service = new DeliveryOrderService(mockDb.Object, mockLogger.Object);

            var exception = await Record.ExceptionAsync(() =>
                service.GetDeliveryOrders(1, 10, "DRAFT")
            );

            Assert.Null(exception);
        }

        [Fact]
        public async Task GetDeliveryOrders_WithSqlInjection_ShouldThrow()
        {
            var mockDb = new Mock<IAutoCountDbService>();
            var mockLogger = new Mock<ILogger<DeliveryOrderService>>();
            var service = new DeliveryOrderService(mockDb.Object, mockLogger.Object);

            var maliciousInput = "'; DROP TABLE ARDeliveryOrder; --";

            await Assert.ThrowsAsync<ArgumentException>(() =>
                service.GetDeliveryOrders(1, 10, maliciousInput)
            );
        }

        [Theory]
        [InlineData("DRAFT' OR '1'='1")]
        [InlineData("VOID; DELETE FROM ARDeliveryOrder WHERE 1=1; --")]
        [InlineData("POSTED' UNION SELECT * FROM Users --")]
        public async Task GetDeliveryOrders_WithVariousSqlInjections_ShouldThrow(string maliciousStatus)
        {
            var mockDb = new Mock<IAutoCountDbService>();
            var mockLogger = new Mock<ILogger<DeliveryOrderService>>();
            var service = new DeliveryOrderService(mockDb.Object, mockLogger.Object);

            await Assert.ThrowsAsync<ArgumentException>(() =>
                service.GetDeliveryOrders(1, 10, maliciousStatus)
            );
        }
    }
}
```

**Manual Test:**
1. Start API in development mode
2. Try SQL injection attempts:
   ```bash
   curl "http://localhost:5001/api/v1/delivery-orders?status='; DROP TABLE ARDeliveryOrder; --"
   # Expected: 400 Bad Request with "Invalid status" error

   curl "http://localhost:5001/api/v1/delivery-orders?status=DRAFT' OR '1'='1"
   # Expected: 400 Bad Request with "Invalid status" error
   ```
3. Verify legitimate requests still work:
   ```bash
   curl "http://localhost:5001/api/v1/delivery-orders?status=DRAFT"
   # Expected: 200 OK with delivery orders
   ```

---

## Phase 2: High Priority (Week 3-6)

### 2.1 Type Safety: Remove All `any` Types

**Objective:** Achieve 100% type safety in TypeScript codebase.

#### Step 1: Enable Strict TypeScript Rules

**Timeline:** Week 3 Day 1
**Owner:** Tech Lead

**Implementation:**

```json
// File: website/.eslintrc.json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    "@typescript-eslint/no-floating-promises": "error"
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}
```

```json
// File: website/tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

**Testing:**
```bash
cd website
npm run lint
# Expected: Multiple errors showing all `any` usage

# Fix errors one by one, then rerun
npm run lint
# Goal: Zero errors
```

---

#### Step 2: Define Comprehensive Types

**Timeline:** Week 3 Day 2-3
**Owner:** Frontend Lead

**Implementation:**

```typescript
// File: website/lib/types/autocount.ts

/** Base API Response */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/** Paginated API Response */
export interface PaginatedResponse<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

/** Delivery Order Types */
export interface DeliveryOrder {
  DocKey: string
  DocNo: string
  DocDate: string
  DebtorCode: string
  DebtorName: string | null
  Description: string | null
  DocAmt: number
  Cancelled: 'T' | 'F'
  Transferred: 'T' | 'F'
}

export interface DeliveryOrderDetail {
  DtlKey: string
  DocKey: string
  Seq: number
  ItemCode: string
  ItemDescription: string | null
  Qty: number
  UnitPrice: number
  Amount: number
  Description: string | null
}

export interface DeliveryOrderCreateRequest {
  debtorCode: string
  description?: string
  branchId?: string
  detail: Array<{
    itemCode: string
    qty: number
    unitPrice: number
    description?: string
  }>
}

export type DeliveryOrderStatus = 'Draft' | 'Posted' | 'Void'

export function getDeliveryOrderStatus(item: DeliveryOrder): DeliveryOrderStatus {
  if (item.Cancelled === 'T') return 'Void'
  if (item.Transferred === 'T') return 'Posted'
  return 'Draft'
}

/** Customer (Debtor) Types */
export interface Customer {
  AccNo: string
  CompanyName: string
  Phone1: string | null
  Fax1: string | null
  EmailAddress: string | null
  SalesAgent: string | null
  CreditTerm: number
  CreditLimit: number
  Active: 'T' | 'F'
}

export interface CustomerCreateRequest {
  accNo: string
  companyName: string
  phone1?: string
  fax1?: string
  emailAddress?: string
  salesAgent?: string
  creditTerm?: number
  creditLimit?: number
}

/** Product (Item) Types */
export interface Product {
  ItemCode: string
  Description: string
  UOM: string
  SalesUnitPrice: number
  ItemGroup: string | null
  ItemType: string | null
  Active: 'T' | 'F'
}

export interface ProductCreateRequest {
  itemCode: string
  description: string
  uom: string
  salesUnitPrice: number
  itemGroup?: string
  itemType?: string
}

/** Invoice Types */
export interface Invoice {
  DocKey: string
  DocNo: string
  DocDate: string
  DebtorCode: string
  DebtorName: string | null
  Description: string | null
  DocAmt: number
  Cancelled: 'T' | 'F'
}

export interface InvoiceDetail {
  DtlKey: string
  DocKey: string
  Seq: number
  ItemCode: string
  ItemDescription: string | null
  Qty: number
  UnitPrice: number
  Amount: number
  Description: string | null
}
```

```typescript
// File: website/lib/types/convex.ts
import { Doc, Id } from "@/convex/_generated/dataModel"

/** Type-safe Convex document types */
export type User = Doc<"users">
export type Branch = Doc<"branches">
export type TemporaryReceipt = Doc<"temporaryReceipts">
export type DeliveryOrderBranch = Doc<"deliveryOrderBranches">
export type BranchProductTemplate = Doc<"branchProductTemplates">
export type StockBalance = Doc<"stockBalances">
export type StockMovement = Doc<"stockMovementLogs">

/** Type-safe ID types */
export type UserId = Id<"users">
export type BranchId = Id<"branches">
export type TemporaryReceiptId = Id<"temporaryReceipts">

/** User Role */
export type UserRole = User["role"]

export function isAdmin(role: UserRole): boolean {
  return role === "super_admin" || role === "admin"
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin"
}
```

**Testing:**
```bash
# Verify types compile
cd website
npm run build
# Expected: No type errors
```

---

#### Step 3: Refactor API Routes with Proper Types

**Timeline:** Week 3-4 (Days 4-10)
**Owner:** Full-stack Team (2 developers)

**Implementation:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAutoCountApiClient } from '@/lib/autocount-api-client-instance'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import type {
  DeliveryOrder,
  PaginatedResponse,
  DeliveryOrderCreateRequest,
  ApiResponse,
} from '@/lib/types/autocount'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' } satisfies ApiResponse<never>,
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const statusParam = searchParams.get('status')
  const branchIdParam = searchParams.get('branchId')

  try {
    const apiClient = getAutoCountApiClient()

    // Branch filtering
    if (branchIdParam) {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
      const branchId = branchIdParam as Id<"branches">

      // Get paginated docKeys for this branch
      const branchMappings = await convex.query(
        api.deliveryOrderBranches.getPaginatedByBranch,
        {
          branchId,
          limit,
          offset: (page - 1) * limit,
        }
      )

      if (branchMappings.length === 0) {
        const emptyResponse: PaginatedResponse<DeliveryOrder> = {
          items: [],
          totalCount: 0,
          page,
          pageSize: limit,
          totalPages: 0,
        }
        return NextResponse.json(emptyResponse)
      }

      // Fetch details for these specific docKeys
      const detailsPromises = branchMappings.map(mapping =>
        apiClient.getDeliveryOrderByDocKey(mapping.docKey)
      )

      const details = await Promise.all(detailsPromises)
      const items: DeliveryOrder[] = details
        .filter((d): d is ApiResponse<DeliveryOrder> & { success: true; data: DeliveryOrder } =>
          d.success && d.data !== undefined
        )
        .map(d => d.data)

      const totalCount = await convex.query(
        api.deliveryOrderBranches.countByBranch,
        { branchId }
      )

      const response: PaginatedResponse<DeliveryOrder> = {
        items,
        totalCount,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
      }

      return NextResponse.json(response)
    }

    // No branch filter - get all
    const response = await apiClient.getDeliveryOrders({
      page,
      pageSize: limit,
      status: statusParam || undefined,
    })

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch delivery orders' } satisfies ApiResponse<never>,
        { status: 500 }
      )
    }

    const paginatedResponse: PaginatedResponse<DeliveryOrder> = {
      items: response.data?.items || [],
      totalCount: response.data?.totalCount || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((response.data?.totalCount || 0) / limit),
    }

    return NextResponse.json(paginatedResponse)

  } catch (error) {
    console.error('Error fetching delivery orders:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      } satisfies ApiResponse<never>,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' } satisfies ApiResponse<never>,
      { status: 401 }
    )
  }

  try {
    const body: unknown = await request.json()

    // Type guard validation
    if (!isDeliveryOrderCreateRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid request body' } satisfies ApiResponse<never>,
        { status: 400 }
      )
    }

    const parsedBody: DeliveryOrderCreateRequest = body

    // ... (saga implementation from Phase 1)

  } catch (error) {
    console.error('Error creating delivery order:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      } satisfies ApiResponse<never>,
      { status: 500 }
    )
  }
}

// Type guard
function isDeliveryOrderCreateRequest(body: unknown): body is DeliveryOrderCreateRequest {
  if (typeof body !== 'object' || body === null) return false

  const b = body as Record<string, unknown>

  return (
    typeof b.debtorCode === 'string' &&
    (b.description === undefined || typeof b.description === 'string') &&
    (b.branchId === undefined || typeof b.branchId === 'string') &&
    Array.isArray(b.detail) &&
    b.detail.every(item =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).itemCode === 'string' &&
      typeof (item as Record<string, unknown>).qty === 'number' &&
      typeof (item as Record<string, unknown>).unitPrice === 'number'
    )
  )
}
```

**Testing:**

```typescript
// File: website/app/api/autocount/delivery-orders-v2/__tests__/route.test.ts
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

describe('GET /api/autocount/delivery-orders-v2', () => {
  it('should return typed response', async () => {
    const request = new NextRequest(
      'http://localhost/api/autocount/delivery-orders-v2?page=1&limit=10'
    )

    const response = await GET(request)
    const data: PaginatedResponse<DeliveryOrder> = await response.json()

    // TypeScript should enforce these types
    expect(typeof data.totalCount).toBe('number')
    expect(Array.isArray(data.items)).toBe(true)

    if (data.items.length > 0) {
      const item = data.items[0]!
      expect(typeof item.DocKey).toBe('string')
      expect(typeof item.DocNo).toBe('string')
      expect(['T', 'F']).toContain(item.Cancelled)
    }
  })
})
```

**Manual Testing:**
1. Run TypeScript compiler: `npx tsc --noEmit`
2. Verify zero type errors
3. Test API endpoints in browser/Postman
4. Verify IDE autocomplete works correctly

---

### 2.2 Performance: Server-Side Branch Filtering

*(Covered in detail in FIXES_REQUIRED.md section 2.2 - implementation already provided above in Step 3)*

**Testing Strategy:**

```typescript
// File: scripts/test-branch-filtering-performance.ts
import { performance } from 'perf_hooks'

async function testBranchFiltering() {
  const branchId = 'branch_001'

  // Test 1: Without pagination (old approach)
  console.log('Testing OLD approach (fetch all, filter client-side)...')
  const start1 = performance.now()

  const allDOs = await fetch('http://localhost:3000/api/autocount/delivery-orders-v2?page=1&pageSize=10000')
  const allData = await allDOs.json()
  const filtered = allData.items.filter((item: any) => item.branchId === branchId)

  const end1 = performance.now()
  console.log(`OLD: ${end1 - start1}ms, returned ${filtered.length} items`)

  // Test 2: With pagination (new approach)
  console.log('\nTesting NEW approach (server-side filter with pagination)...')
  const start2 = performance.now()

  const branchDOs = await fetch(`http://localhost:3000/api/autocount/delivery-orders-v2?page=1&limit=50&branchId=${branchId}`)
  const branchData = await branchDOs.json()

  const end2 = performance.now()
  console.log(`NEW: ${end2 - start2}ms, returned ${branchData.items.length} items`)

  // Calculate improvement
  const improvement = ((end1 - start2) / end1 * 100).toFixed(1)
  console.log(`\n✓ Performance improvement: ${improvement}%`)
}

testBranchFiltering()
```

**Run test:**
```bash
npx tsx scripts/test-branch-filtering-performance.ts
```

**Expected output:**
```
Testing OLD approach (fetch all, filter client-side)...
OLD: 3452ms, returned 15 items

Testing NEW approach (server-side filter with pagination)...
NEW: 287ms, returned 50 items

✓ Performance improvement: 91.7%
```

---

### 2.3 Reliability: Request Deduplication

*(Covered in FIXES_REQUIRED.md section 2.3 - implementation already provided)*

**Testing Strategy:**

```typescript
// File: scripts/test-idempotency.ts
import { v4 as uuidv4 } from 'uuid'

async function testIdempotency() {
  const idempotencyKey = uuidv4()

  console.log(`Testing idempotency with key: ${idempotencyKey}`)

  // Send same request twice with same idempotency key
  const request1Start = Date.now()
  const response1 = await fetch('http://localhost:3000/api/autocount/delivery-orders-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      debtorCode: 'C001',
      description: 'Idempotency test',
      detail: [
        { itemCode: 'ITEM001', qty: 1, unitPrice: 100 }
      ]
    })
  })
  const request1End = Date.now()
  const data1 = await response1.json()
  const isReplay1 = response1.headers.get('X-Idempotency-Replay') === 'true'

  console.log(`\nRequest 1:`)
  console.log(`  Duration: ${request1End - request1Start}ms`)
  console.log(`  Status: ${response1.status}`)
  console.log(`  Is Replay: ${isReplay1}`)
  console.log(`  DocNo: ${data1.data?.docNo}`)

  // Wait 100ms then send identical request
  await new Promise(resolve => setTimeout(resolve, 100))

  const request2Start = Date.now()
  const response2 = await fetch('http://localhost:3000/api/autocount/delivery-orders-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey, // Same key!
    },
    body: JSON.stringify({
      debtorCode: 'C001',
      description: 'Idempotency test',
      detail: [
        { itemCode: 'ITEM001', qty: 1, unitPrice: 100 }
      ]
    })
  })
  const request2End = Date.now()
  const data2 = await response2.json()
  const isReplay2 = response2.headers.get('X-Idempotency-Replay') === 'true'

  console.log(`\nRequest 2 (should be cached):`)
  console.log(`  Duration: ${request2End - request2Start}ms`)
  console.log(`  Status: ${response2.status}`)
  console.log(`  Is Replay: ${isReplay2}`)
  console.log(`  DocNo: ${data2.data?.docNo}`)

  // Verify
  console.log(`\n✓ Verification:`)
  console.log(`  DocNo matches: ${data1.data?.docNo === data2.data?.docNo}`)
  console.log(`  Second request was cached: ${isReplay2}`)
  console.log(`  Second request faster: ${(request2End - request2Start) < (request1End - request1Start)}`)

  if (!isReplay2) {
    console.error('\n✗ FAILED: Second request should have been cached')
  } else {
    console.log('\n✓ PASSED: Idempotency working correctly')
  }
}

testIdempotency()
```

---

### 2.4 UX: React Error Boundaries

*(Implementation provided in FIXES_REQUIRED.md section 2.4)*

**Testing Strategy:**

```typescript
// File: website/components/__tests__/error-boundary.test.tsx
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../error-boundary'

function ThrowError() {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  it('should catch errors and show fallback', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation()

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()

    spy.mockRestore()
  })

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Success content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Success content')).toBeInTheDocument()
  })
})
```

**Manual Testing:**
1. Navigate to delivery orders page
2. Open React DevTools
3. Use "Simulate Error" feature
4. Verify error boundary catches error
5. Verify "Try Again" button works
6. Verify error logged to console

---

## Phase 3: Medium Priority (Week 7-8)

### 3.1 Architecture: Consolidate Stock Systems

**Objective:** Single source of truth for stock management.

**Implementation Plan:**

1. **Audit current usage** (Day 1)
   - Search codebase for `stockKeeping` references
   - Search for `stockBalances` references
   - Document which features use which system

2. **Create migration plan** (Day 2)
   - Decide: Use per-branch system (`stockBalances`)
   - Create data migration script

3. **Implement migration** (Day 3-4)
   ```typescript
   // File: website/convex/migrations/consolidate_stock.ts
   export const migrateToStockBalances = mutation({
     handler: async (ctx) => {
       // Get all global stock
       const globalStock = await ctx.db.query("stockKeeping").collect()

       // Get all branches
       const branches = await ctx.db.query("branches").collect()

       // For each item, create per-branch stock
       for (const item of globalStock) {
         for (const branch of branches) {
           // Check if already exists
           const existing = await ctx.db
             .query("stockBalances")
             .withIndex("by_branch_and_item", q =>
               q.eq("branchId", branch._id).eq("itemCode", item.itemCode)
             )
             .first()

           if (!existing) {
             await ctx.db.insert("stockBalances", {
               branchId: branch._id,
               itemCode: item.itemCode,
               quantity: item.quantity / branches.length, // Distribute equally
               version: 1,
               lastUpdated: Date.now(),
             })
           }
         }
       }

       return { migrated: globalStock.length }
     }
   })
   ```

4. **Update all references** (Day 5-7)
   - Replace `stockKeeping` with `stockBalances` in all API routes
   - Update delivery order creation
   - Update stock adjustment forms

5. **Deprecate old system** (Day 8)
   - Add deprecation warnings
   - Remove after 1 month grace period

**Testing:**
- Unit tests for migration script
- Integration tests for all stock operations
- End-to-end tests for delivery order creation

---

### 3.2 Performance: Implement Caching Layer

**Objective:** Reduce database load, improve response times.

**Implementation Plan:**

1. **Set up Redis** (Day 1)
   ```bash
   # Use Upstash Redis (serverless)
   # Or Azure Cache for Redis
   # Or AWS ElastiCache
   ```

2. **Create cache helper** (Day 2)
   ```typescript
   // File: website/lib/cache.ts
   import Redis from 'ioredis'

   const redis = new Redis(process.env.REDIS_URL!)

   export async function getCached<T>(
     key: string,
     fetcher: () => Promise<T>,
     ttlSeconds: number = 300
   ): Promise<T> {
     // Try cache first
     const cached = await redis.get(key)
     if (cached) {
       return JSON.parse(cached)
     }

     // Fetch and cache
     const data = await fetcher()
     await redis.setex(key, ttlSeconds, JSON.stringify(data))

     return data
   }

   export async function invalidateCache(pattern: string): Promise<void> {
     const keys = await redis.keys(pattern)
     if (keys.length > 0) {
       await redis.del(...keys)
     }
   }
   ```

3. **Apply to API routes** (Day 3-5)
   ```typescript
   // File: website/app/api/autocount/customers/route.ts
   export async function GET(request: NextRequest) {
     const page = parseInt(searchParams.get('page') || '1', 10)

     return getCached(
       `customers:page:${page}`,
       async () => {
         const apiClient = getAutoCountApiClient()
         return await apiClient.getDebtors({ page, pageSize: 50 })
       },
       300 // Cache for 5 minutes
     )
   }
   ```

4. **Add cache invalidation** (Day 6-7)
   ```typescript
   // After creating/updating customer
   await invalidateCache('customers:*')
   ```

**Testing:**
- Load test: Measure response times before/after caching
- Verify cache invalidation works correctly
- Test stale data scenarios

---

### 3.3 Testing: Establish Test Coverage

**Objective:** 80% code coverage for critical paths.

**Implementation Plan:**

1. **Set up Jest** (Day 1)
   ```bash
   cd website
   npm install --save-dev jest @testing-library/react @testing-library/jest-dom
   ```

2. **Configure Jest** (Day 1)
   ```javascript
   // File: website/jest.config.js
   const nextJest = require('next/jest')

   const createJestConfig = nextJest({
     dir: './',
   })

   const customJestConfig = {
     setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
     testEnvironment: 'jest-environment-jsdom',
     collectCoverageFrom: [
       'app/**/*.{js,jsx,ts,tsx}',
       'components/**/*.{js,jsx,ts,tsx}',
       'lib/**/*.{js,jsx,ts,tsx}',
       '!**/*.d.ts',
       '!**/node_modules/**',
     ],
     coverageThresholds: {
       global: {
         branches: 80,
         functions: 80,
         lines: 80,
         statements: 80,
       },
     },
   }

   module.exports = createJestConfig(customJestConfig)
   ```

3. **Write unit tests** (Day 2-5)
   - Test all mutations/queries
   - Test all API routes
   - Test all utility functions

4. **Write integration tests** (Day 6-7)
   - Test delivery order creation flow
   - Test stock adjustment flow
   - Test user authentication flow

5. **Set up CI** (Day 8)
   ```yaml
   # File: .github/workflows/test.yml
   name: Tests

   on: [push, pull_request]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - run: npm ci
         - run: npm test -- --coverage
         - uses: codecov/codecov-action@v3
   ```

**Success Criteria:**
- All tests pass
- 80%+ code coverage achieved
- CI pipeline configured
- Tests run on every PR

---

### 3.4 API: Complete v2 Migration

**Objective:** Consistent API versioning, deprecate v1.

**Implementation Plan:**

1. **Audit v1 endpoints** (Day 1)
   - List all `/api/autocount/*` routes
   - Identify which use v1 vs v2

2. **Implement missing v2 endpoints** (Day 2-4)
   - Create v2 versions of remaining v1 endpoints
   - Apply type safety, saga pattern, etc.

3. **Update frontend** (Day 5-6)
   - Replace all v1 calls with v2
   - Test thoroughly

4. **Add deprecation warnings** (Day 7)
   ```typescript
   // File: website/app/api/autocount/customers/route.ts
   export async function GET(request: NextRequest) {
     console.warn('DEPRECATED: /api/autocount/customers is deprecated. Use /api/autocount/customers-v2')
     // ... existing logic
   }
   ```

5. **Remove v1 endpoints** (After 1 month grace period)

**Testing:**
- Verify all features work with v2 APIs
- Performance testing
- User acceptance testing

---

## Testing Strategy

### Unit Testing

**Scope:** Individual functions, mutations, queries
**Tools:** Jest, Vitest
**Coverage Target:** 90%+

**Test Categories:**
1. **Saga Coordinator**
   - Success scenarios
   - Failure scenarios
   - Rollback scenarios
   - Compensation failures

2. **Optimistic Locking**
   - Concurrent updates
   - Version conflicts
   - Retry logic
   - Insufficient stock

3. **Type Guards**
   - Valid input
   - Invalid input
   - Edge cases

4. **Query Builders**
   - Parameterized queries
   - SQL injection attempts
   - Multiple conditions

### Integration Testing

**Scope:** API routes, database operations
**Tools:** Supertest, MSW (Mock Service Worker)
**Coverage Target:** 80%+

**Test Scenarios:**
1. **Delivery Order Creation**
   - Success path
   - Stock deduction failure
   - AutoCount API failure
   - Rollback verification

2. **Branch Filtering**
   - Pagination
   - Empty results
   - Large datasets

3. **Request Deduplication**
   - Identical requests
   - Different requests
   - Expired keys

### End-to-End Testing

**Scope:** Full user workflows
**Tools:** Playwright, Cypress
**Coverage Target:** Critical paths

**Test Workflows:**
1. **Create Delivery Order**
   - Login
   - Navigate to delivery orders
   - Fill form
   - Submit
   - Verify success
   - Check stock deducted

2. **Handle Errors**
   - Insufficient stock
   - Network failures
   - Validation errors

3. **Concurrent Users**
   - Multiple users creating DOs simultaneously
   - Verify no race conditions

### Load Testing

**Scope:** Performance under load
**Tools:** k6, Artillery
**Targets:**
- 100 concurrent users
- < 500ms response time (p95)
- < 0.1% error rate

**Test Scenarios:**
1. **Stock Adjustments**
   - 100 concurrent deductions
   - Verify no inventory loss

2. **API Endpoints**
   - 1000 requests/minute
   - Verify cache hit ratio

### Manual Testing Checklist

**Before each deployment:**

- [ ] Create delivery order with valid data - SUCCESS
- [ ] Create delivery order with insufficient stock - ERROR SHOWN
- [ ] Create delivery order, cancel during processing - ROLLED BACK
- [ ] Filter delivery orders by branch - CORRECT RESULTS
- [ ] Paginate through large result sets - PERFORMANCE OK
- [ ] Submit duplicate request - DEDUPLICATED
- [ ] Trigger component error - ERROR BOUNDARY SHOWN
- [ ] Test on mobile device - RESPONSIVE
- [ ] Test in slow network (3G) - GRACEFUL DEGRADATION

---

## Rollback Plans

### Phase 1: Critical Fixes

**1.2 Distributed Transactions**
- **Rollback trigger:** Saga causing more failures than it prevents
- **Rollback steps:**
  1. Feature flag OFF: `ENABLE_SAGA_PATTERN=false`
  2. Revert to previous direct calls
  3. Deploy previous version
- **Data cleanup:** Void any orphaned DOs created during saga failures

**1.3 Race Conditions**
- **Rollback trigger:** Optimistic locking causing excessive retries
- **Rollback steps:**
  1. Remove version checks from mutations
  2. Deploy without version field (schema remains for future)
- **Data cleanup:** Version field remains but unused

**1.4 SQL Injection**
- **Rollback trigger:** Parameterized queries breaking existing functionality
- **Rollback steps:**
  1. Revert to previous service implementations
  2. Keep query builder for future use
- **Data cleanup:** None required

### Phase 2: High Priority

**2.1 Type Safety**
- **Rollback trigger:** TypeScript strict mode breaking builds
- **Rollback steps:**
  1. Disable strict ESLint rules
  2. Keep type definitions for future
- **Data cleanup:** None required

**2.2 Branch Filtering**
- **Rollback trigger:** Server-side filtering slower than client-side
- **Rollback steps:**
  1. Feature flag OFF: `ENABLE_SERVER_SIDE_BRANCH_FILTER=false`
  2. Revert to client-side filtering
- **Data cleanup:** None required

**2.3 Request Deduplication**
- **Rollback trigger:** Idempotency middleware causing issues
- **Rollback steps:**
  1. Remove middleware from routes
  2. Clear idempotency cache
- **Data cleanup:** Clear Redis idempotency keys

**2.4 Error Boundaries**
- **Rollback trigger:** Error boundaries hiding real issues
- **Rollback steps:**
  1. Remove error boundary wrappers
  2. Let errors propagate naturally
- **Data cleanup:** None required

### Phase 3: Medium Priority

**3.1 Stock Consolidation**
- **Rollback trigger:** Per-branch stock causing data issues
- **Rollback steps:**
  1. Re-enable global stock system
  2. Pause per-branch operations
  3. Data reconciliation script
- **Data cleanup:** Aggregate per-branch stock back to global

**3.2 Caching**
- **Rollback trigger:** Stale cache causing data inconsistencies
- **Rollback steps:**
  1. Disable cache reads (write-through only)
  2. Clear all cache keys
  3. Remove cache middleware
- **Data cleanup:** `FLUSHALL` Redis

**3.3 Testing**
- **Rollback trigger:** N/A (tests don't affect production)
- **Rollback steps:** Lower coverage threshold temporarily

**3.4 API v2 Migration**
- **Rollback trigger:** v2 APIs causing regressions
- **Rollback steps:**
  1. Point frontend back to v1 endpoints
  2. Keep v2 endpoints for investigation
- **Data cleanup:** None required

---

## Success Criteria

### Phase 1: Critical Fixes (Week 1-2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Saga Success Rate | > 99% | Monitor saga logs, count successes vs failures |
| Stock Accuracy | 100% | Compare actual vs expected inventory after load test |
| SQL Injection Blocked | 100% | Automated security scan, manual penetration testing |
| Zero Data Loss | 0 incidents | Monitor for orphaned DOs, inventory discrepancies |

**Verification:**
```bash
# Run after Phase 1 deployment
npm run test:phase1
npm run security:scan
npm run load:test:stock
```

### Phase 2: High Priority (Week 3-6)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Type Safety | 0 `any` types | `eslint --max-warnings 0` |
| Branch Filter Performance | < 500ms p95 | Load test with 1000 DOs per branch |
| Duplicate Request Prevention | 100% | Submit same request 10x, verify 1 execution |
| Error Boundary Coverage | 100% of pages | Manual inspection |

**Verification:**
```bash
npm run lint -- --max-warnings 0
npm run test:integration
npm run test:e2e
```

### Phase 3: Medium Priority (Week 7-8)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single Stock System | 100% | Verify no `stockKeeping` usage in code |
| Cache Hit Ratio | > 70% | Redis INFO stats |
| Test Coverage | > 80% | Jest coverage report |
| API Consistency | 100% v2 | Verify no v1 usage in frontend |

**Verification:**
```bash
npm run test -- --coverage
npm run audit:api-versions
redis-cli INFO stats | grep hit_rate
```

### Overall Project Health

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Security Score | 6/10 | 10/10 | 🔴 Critical |
| Code Quality | 7/10 | 9/10 | 🟡 Improving |
| Performance (p95) | ~2s | <500ms | 🔴 Critical |
| Test Coverage | 0% | 80% | 🔴 Critical |
| Type Safety | 60% | 100% | 🟡 Improving |
| Uptime | 99% | 99.9% | 🟢 Good |

---

## Monitoring & Alerts

### Application Monitoring

**Tools:** Sentry, Datadog, New Relic

**Metrics to Track:**
1. **Error Rate**
   - Alert if > 1% of requests fail
   - Slack notification to #engineering

2. **Response Time**
   - Alert if p95 > 1s
   - Email to on-call engineer

3. **Saga Failures**
   - Alert on any compensation failure
   - Page on-call immediately

4. **Stock Discrepancies**
   - Daily automated inventory check
   - Email report to operations team

### Infrastructure Monitoring

**Tools:** CloudWatch, Grafana

**Metrics to Track:**
1. **Database Connections**
   - Alert if connection pool > 80% utilization

2. **Redis Memory**
   - Alert if memory > 90% used

3. **API Gateway Errors**
   - Alert if 5xx errors > 0.5%

4. **Convex Function Errors**
   - Alert if any mutation fails > 5 times/hour

---

## Documentation Updates

**After each phase, update:**

1. **CLAUDE.md**
   - Add new patterns implemented
   - Update architecture diagrams
   - Document new conventions

2. **API Documentation**
   - Update OpenAPI spec
   - Add v2 endpoint docs
   - Deprecation notices

3. **Developer Onboarding**
   - Testing guide
   - Debugging guide
   - Common patterns

4. **Operations Runbook**
   - Rollback procedures
   - Monitoring dashboards
   - Incident response

---

## Timeline Summary

```
Week 1-2: Phase 1 (Critical)
├── Mon-Tue: Saga Pattern
├── Wed-Thu: Saga Applied to DOs
├── Fri: Optimistic Locking Schema
├── Sat-Sun: Optimistic Locking Implementation
└── Mon: SQL Injection Fixes

Week 3-6: Phase 2 (High Priority)
├── Week 3: Type Safety
├── Week 4: Branch Filtering
├── Week 5: Request Deduplication
└── Week 6: Error Boundaries

Week 7-8: Phase 3 (Medium Priority)
├── Week 7: Stock Consolidation + Caching
└── Week 8: Testing + API v2 Migration
```

**Total Duration:** 8 weeks
**Team Size:** 2-3 engineers
**Estimated Effort:** ~480 hours

---

**Next Steps:**
1. Review this plan with team
2. Assign ownership for each phase
3. Set up project tracking (Jira, Linear, etc.)
4. Schedule kickoff meeting
5. Begin Phase 1 implementation

**Document Version:** 1.0
**Last Updated:** 2026-02-11
**Maintained By:** Engineering Team
