import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

const MOVEMENT_TYPES = {
  DO_OUT: 'DO_OUT',
  DO_VOID_IN: 'DO_VOID_IN',
  ADJUSTMENT: 'ADJUSTMENT',
  GOODS_RECEIPT: 'GOODS_RECEIPT',
  STOCK_TAKE: 'STOCK_TAKE',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
} as const

const REFERENCE_TYPES = {
  DELIVERY_ORDER: 'DELIVERY_ORDER',
  ADJUSTMENT: 'ADJUSTMENT',
  STOCK_TAKE: 'STOCK_TAKE',
  TRANSFER: 'TRANSFER',
  GOODS_RECEIPT: 'GOODS_RECEIPT',
} as const

// ——— Queries ———

export const getBalancesByBranch = query({
  args: {
    branchId: v.id('branches'),
    itemCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('stockBalances')
      .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
    const balances = await q.collect()
    if (args.itemCode) {
      return balances.filter((b) => b.itemCode === args.itemCode)
    }
    return balances.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
  },
})

export const getBalance = query({
  args: {
    branchId: v.id('branches'),
    itemCode: v.string(),
  },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query('stockBalances')
      .withIndex('by_branch_item', (q) =>
        q.eq('branchId', args.branchId).eq('itemCode', args.itemCode)
      )
      .first()
    return balance ?? null
  },
})

export const getMovements = query({
  args: {
    branchId: v.id('branches'),
    itemCode: v.optional(v.string()),
    fromTime: v.optional(v.number()),
    toTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('stockMovements')
      .withIndex('by_branch_created', (q) => q.eq('branchId', args.branchId))
    const movements = await q.order('desc').collect()
    let filtered = movements
    if (args.itemCode) {
      filtered = filtered.filter((m) => m.itemCode === args.itemCode)
    }
    if (args.fromTime != null) {
      filtered = filtered.filter((m) => m.createdAt >= args.fromTime!)
    }
    if (args.toTime != null) {
      filtered = filtered.filter((m) => m.createdAt <= args.toTime!)
    }
    const limit = args.limit ?? 100
    return filtered.slice(0, limit)
  },
})

// ——— Mutations ———

/** Deduct stock for a delivery order (DO created). Idempotent per (docKey, itemCode). */
export const deductForDeliveryOrder = mutation({
  args: {
    branchId: v.id('branches'),
    docKey: v.number(),
    lines: v.array(
      v.object({
        itemCode: v.string(),
        quantity: v.number(),
      })
    ),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const line of args.lines) {
      const itemCode = line.itemCode?.trim()
      const qty = line.quantity || 0
      if (!itemCode || qty <= 0) continue

      // Idempotency: skip if we already have a DO_OUT for this DO and item
      const doMovements = await ctx.db
        .query('stockMovements')
        .withIndex('by_reference', (q) =>
          q.eq('referenceType', REFERENCE_TYPES.DELIVERY_ORDER).eq('referenceId', String(args.docKey))
        )
        .collect()
      const alreadyDeducted = doMovements.some(
        (m) => m.itemCode === itemCode && m.movementType === MOVEMENT_TYPES.DO_OUT
      )
      if (alreadyDeducted) continue

      const balanceRow = await ctx.db
        .query('stockBalances')
        .withIndex('by_branch_item', (q) =>
          q.eq('branchId', args.branchId).eq('itemCode', itemCode)
        )
        .first()

      const currentQty = balanceRow?.quantityOnHand ?? 0
      const newQty = currentQty - qty

      await ctx.db.insert('stockMovements', {
        branchId: args.branchId,
        itemCode,
        quantityDelta: -qty,
        quantityAfter: newQty,
        movementType: MOVEMENT_TYPES.DO_OUT,
        referenceType: REFERENCE_TYPES.DELIVERY_ORDER,
        referenceId: String(args.docKey),
        userId: args.userId,
        createdAt: now,
      })

      if (balanceRow) {
        await ctx.db.patch(balanceRow._id, {
          quantityOnHand: newQty,
          lastMovementAt: now,
          lastMovementBy: args.userId,
        })
      } else {
        await ctx.db.insert('stockBalances', {
          branchId: args.branchId,
          itemCode,
          quantityOnHand: newQty,
          lastMovementAt: now,
          lastMovementBy: args.userId,
        })
      }
    }
    return { success: true }
  },
})

/** Restore stock when a delivery order is voided. Idempotent per (docKey, itemCode). */
export const restoreForDeliveryOrderVoid = mutation({
  args: {
    branchId: v.id('branches'),
    docKey: v.number(),
    lines: v.array(
      v.object({
        itemCode: v.string(),
        quantity: v.number(),
      })
    ),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const line of args.lines) {
      const itemCode = line.itemCode?.trim()
      const qty = line.quantity || 0
      if (!itemCode || qty <= 0) continue

      // Idempotency: skip if we already restored (DO_VOID_IN) for this DO and item
      const doMovementsVoid = await ctx.db
        .query('stockMovements')
        .withIndex('by_reference', (q) =>
          q.eq('referenceType', REFERENCE_TYPES.DELIVERY_ORDER).eq('referenceId', String(args.docKey))
        )
        .collect()
      const alreadyRestored = doMovementsVoid.some(
        (m) => m.itemCode === itemCode && m.movementType === MOVEMENT_TYPES.DO_VOID_IN
      )
      if (alreadyRestored) continue

      const balanceRow = await ctx.db
        .query('stockBalances')
        .withIndex('by_branch_item', (q) =>
          q.eq('branchId', args.branchId).eq('itemCode', itemCode)
        )
        .first()

      const currentQty = balanceRow?.quantityOnHand ?? 0
      const newQty = currentQty + qty

      await ctx.db.insert('stockMovements', {
        branchId: args.branchId,
        itemCode,
        quantityDelta: qty,
        quantityAfter: newQty,
        movementType: MOVEMENT_TYPES.DO_VOID_IN,
        referenceType: REFERENCE_TYPES.DELIVERY_ORDER,
        referenceId: String(args.docKey),
        userId: args.userId,
        createdAt: now,
      })

      if (balanceRow) {
        await ctx.db.patch(balanceRow._id, {
          quantityOnHand: newQty,
          lastMovementAt: now,
          lastMovementBy: args.userId,
        })
      } else {
        await ctx.db.insert('stockBalances', {
          branchId: args.branchId,
          itemCode,
          quantityOnHand: newQty,
          lastMovementAt: now,
          lastMovementBy: args.userId,
        })
      }
    }
    return { success: true }
  },
})

/** Manual adjustment: apply quantityDelta (positive = in, negative = out) and optional remarks. */
export const adjustStock = mutation({
  args: {
    branchId: v.id('branches'),
    itemCode: v.string(),
    quantityDelta: v.number(),
    userId: v.string(),
    notes: v.optional(v.string()),
    balanceRemarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const itemCode = args.itemCode.trim()
    if (!itemCode) throw new Error('itemCode is required')

    const balanceRow = await ctx.db
      .query('stockBalances')
      .withIndex('by_branch_item', (q) =>
        q.eq('branchId', args.branchId).eq('itemCode', itemCode)
      )
      .first()

    const currentQty = balanceRow?.quantityOnHand ?? 0
    const newQty = currentQty + args.quantityDelta

    await ctx.db.insert('stockMovements', {
      branchId: args.branchId,
      itemCode,
      quantityDelta: args.quantityDelta,
      quantityAfter: newQty,
      movementType: MOVEMENT_TYPES.ADJUSTMENT,
      referenceType: REFERENCE_TYPES.ADJUSTMENT,
      referenceId: `adj-${now}-${args.userId}`,
      userId: args.userId,
      createdAt: now,
      notes: args.notes,
    })

    const patch: Record<string, unknown> = {
      quantityOnHand: newQty,
      lastMovementAt: now,
      lastMovementBy: args.userId,
    }
    if (args.balanceRemarks !== undefined) {
      patch.remarks = args.balanceRemarks
    }

    if (balanceRow) {
      await ctx.db.patch(balanceRow._id, patch)
      return balanceRow._id
    } else {
      return await ctx.db.insert('stockBalances', {
        branchId: args.branchId,
        itemCode,
        quantityOnHand: newQty,
        lastMovementAt: now,
        lastMovementBy: args.userId,
        remarks: args.balanceRemarks,
      })
    }
  },
})

/** One-time migration: copy legacy stockKeeping rows into stockBalances for a branch. */
export const migrateFromStockKeeping = mutation({
  args: {
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    const legacy = await ctx.db.query('stockKeeping').collect()
    const now = Date.now()
    let count = 0
    for (const row of legacy) {
      const existing = await ctx.db
        .query('stockBalances')
        .withIndex('by_branch_item', (q) =>
          q.eq('branchId', args.branchId).eq('itemCode', row.itemCode)
        )
        .first()
      if (existing) {
        continue
      }
      await ctx.db.insert('stockBalances', {
        branchId: args.branchId,
        itemCode: row.itemCode,
        quantityOnHand: row.quantity,
        lastMovementAt: row.lastUpdated,
        lastMovementBy: row.lastUpdatedBy,
        remarks: row.notes,
      })
      count++
    }
    return { migrated: count, total: legacy.length }
  },
})
