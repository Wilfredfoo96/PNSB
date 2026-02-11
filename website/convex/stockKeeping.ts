import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

// Query to get all stock items
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const stocks = await ctx.db
      .query('stockKeeping')
      .collect()
    
    // Sort by itemCode
    stocks.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
    
    return stocks
  },
})

// Query to get stock by item code
export const getByItemCode = query({
  args: {
    itemCode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stockKeeping')
      .withIndex('by_item_code', (q) => q.eq('itemCode', args.itemCode))
      .first()
  },
})

// Query to get movement logs for an item (in/out with notes, time, etc.)
// Optional filters: fromTime, toTime (ms), movementType (DO_OUT | DO_VOID_IN | ADJUSTMENT)
export const getMovementLogsByItem = query({
  args: {
    itemCode: v.string(),
    limit: v.optional(v.number()),
    fromTime: v.optional(v.number()),
    toTime: v.optional(v.number()),
    movementType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db
      .query('stockMovementLogs')
      .withIndex('by_item_created', (q) => q.eq('itemCode', args.itemCode))
      .order('desc')
      .take(args.limit ?? 200)
    if (args.fromTime != null) {
      logs = logs.filter((l) => l.createdAt >= args.fromTime!)
    }
    if (args.toTime != null) {
      logs = logs.filter((l) => l.createdAt <= args.toTime!)
    }
    if (args.movementType != null && args.movementType !== '') {
      logs = logs.filter((l) => l.movementType === args.movementType)
    }
    return logs
  },
})

// Adjust stock and record a movement log (for DO create/void and manual delta)
export const adjustStockAndLog = mutation({
  args: {
    itemCode: v.string(),
    quantityChange: v.number(),
    userId: v.string(),
    movementType: v.string(),
    referenceType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const itemCode = args.itemCode.trim()
    if (!itemCode) throw new Error('itemCode is required')

    const existing = await ctx.db
      .query('stockKeeping')
      .withIndex('by_item_code', (q) => q.eq('itemCode', itemCode))
      .first()

    const now = Date.now()
    const currentQuantity = existing?.quantity ?? 0
    const newQuantity = currentQuantity + args.quantityChange

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: newQuantity,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
        lastMovementType: args.movementType,
        lastMovementDelta: args.quantityChange,
      })
    } else {
      await ctx.db.insert('stockKeeping', {
        itemCode,
        quantity: newQuantity,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
        lastMovementType: args.movementType,
        lastMovementDelta: args.quantityChange,
      })
    }

    await ctx.db.insert('stockMovementLogs', {
      itemCode,
      quantityDelta: args.quantityChange,
      quantityAfter: newQuantity,
      movementType: args.movementType,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      userId: args.userId,
      createdAt: now,
      notes: args.notes,
    })

    return { success: true, newQuantity }
  },
})

// Mutation to update stock quantity (for manual edits); also records an ADJUSTMENT log
export const updateQuantity = mutation({
  args: {
    itemCode: v.string(),
    quantity: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stockKeeping')
      .withIndex('by_item_code', (q) => q.eq('itemCode', args.itemCode))
      .first()

    const now = Date.now()
    const previousQuantity = existing?.quantity ?? 0
    const quantityDelta = args.quantity - previousQuantity

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        location: args.location,
        notes: args.notes,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
        lastMovementType: 'ADJUSTMENT',
        lastMovementDelta: quantityDelta,
      })
    } else {
      await ctx.db.insert('stockKeeping', {
        itemCode: args.itemCode,
        quantity: args.quantity,
        location: args.location,
        notes: args.notes,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
        lastMovementType: 'ADJUSTMENT',
        lastMovementDelta: quantityDelta,
      })
    }

    // Record movement log for manual adjustment (even if delta is 0, for audit)
    await ctx.db.insert('stockMovementLogs', {
      itemCode: args.itemCode,
      quantityDelta,
      quantityAfter: args.quantity,
      movementType: 'ADJUSTMENT',
      referenceType: 'ADJUSTMENT',
      referenceId: `adj-${now}`,
      userId: args.userId,
      createdAt: now,
      notes: args.notes,
    })

    return existing?._id ?? null
  },
})

// Mutation to adjust stock only (no log) — kept for backward compat; prefer adjustStockAndLog
export const adjustStock = mutation({
  args: {
    itemCode: v.string(),
    quantityChange: v.number(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stockKeeping')
      .withIndex('by_item_code', (q) => q.eq('itemCode', args.itemCode))
      .first()

    const now = Date.now()
    const currentQuantity = existing?.quantity ?? 0
    const newQuantity = currentQuantity + args.quantityChange

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: newQuantity,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
      })
      return existing._id
    } else {
      return await ctx.db.insert('stockKeeping', {
        itemCode: args.itemCode,
        quantity: newQuantity,
        lastUpdated: now,
        lastUpdatedBy: args.userId,
      })
    }
  },
})
