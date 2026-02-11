import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

// Query to get product templates for a branch
export const getByBranch = query({
  args: {
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query('branchProductTemplates')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()
    
    // Sort by sequence
    templates.sort((a, b) => a.seq - b.seq)
    
    return templates
  },
})

// Mutation to create or update a product template
export const upsert = mutation({
  args: {
    branchId: v.id('branches'),
    itemCode: v.string(),
    nricTaxCode: v.optional(v.string()),
    passportTaxCode: v.optional(v.string()),
    defaultQty: v.optional(v.number()),
    defaultPrice: v.optional(v.number()),
    seq: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if template already exists
    const existing = await ctx.db
      .query('branchProductTemplates')
      .withIndex('by_branch_item', (q) => 
        q.eq('branchId', args.branchId).eq('itemCode', args.itemCode)
      )
      .first()
    
    const now = Date.now()
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        nricTaxCode: args.nricTaxCode,
        passportTaxCode: args.passportTaxCode,
        defaultQty: args.defaultQty,
        defaultPrice: args.defaultPrice,
        seq: args.seq,
        updatedAt: now,
      })
      return existing._id
    } else {
      // Create new
      return await ctx.db.insert('branchProductTemplates', {
        branchId: args.branchId,
        itemCode: args.itemCode,
        nricTaxCode: args.nricTaxCode,
        passportTaxCode: args.passportTaxCode,
        defaultQty: args.defaultQty,
        defaultPrice: args.defaultPrice,
        seq: args.seq,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

// Mutation to delete a product template
export const remove = mutation({
  args: {
    templateId: v.id('branchProductTemplates'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.templateId)
    return { success: true }
  },
})
