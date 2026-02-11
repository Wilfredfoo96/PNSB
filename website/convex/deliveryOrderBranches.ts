import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

/**
 * Create or update a delivery order branch mapping
 */
export const upsert = mutation({
  args: {
    docKey: v.number(),
    docNo: v.string(),
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    const { docKey, docNo, branchId } = args
    
    // Check if mapping already exists
    const existing = await ctx.db
      .query('deliveryOrderBranches')
      .withIndex('by_doc_key', (q) => q.eq('docKey', docKey))
      .first()
    
    if (existing) {
      // Update existing mapping
      await ctx.db.patch(existing._id, {
        docNo,
        branchId,
      })
      return existing._id
    } else {
      // Create new mapping
      return await ctx.db.insert('deliveryOrderBranches', {
        docKey,
        docNo,
        branchId,
        createdAt: Date.now(),
      })
    }
  },
})

/**
 * Get branch ID for a delivery order by DocKey
 */
export const getByDocKey = query({
  args: {
    docKey: v.number(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query('deliveryOrderBranches')
      .withIndex('by_doc_key', (q) => q.eq('docKey', args.docKey))
      .first()
    
    return mapping?.branchId || null
  },
})

/**
 * Get branch ID for a delivery order by DocNo
 */
export const getByDocNo = query({
  args: {
    docNo: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query('deliveryOrderBranches')
      .withIndex('by_doc_no', (q) => q.eq('docNo', args.docNo))
      .first()
    
    return mapping?.branchId || null
  },
})

/**
 * Get all DocKeys for a specific branch
 */
export const getDocKeysByBranch = query({
  args: {
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query('deliveryOrderBranches')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()
    
    return mappings.map((m) => m.docKey)
  },
})

/**
 * Get all DocNos for a specific branch
 */
export const getDocNosByBranch = query({
  args: {
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query('deliveryOrderBranches')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()
    
    return mappings.map((m) => m.docNo)
  },
})
