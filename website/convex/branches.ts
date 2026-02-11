import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { QueryCtx, MutationCtx } from './_generated/server'

// Query to get all branches
export const getBranches = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const branches = await ctx.db
      .query('branches')
      .order('desc')
      .collect()
    
    return branches
  },
})

// Query to get a single branch by ID
export const getBranchById = query({
  args: {
    id: v.id('branches'),
  },
  handler: async (ctx: QueryCtx, args: { id: Id<'branches'> }) => {
    const branch = await ctx.db.get(args.id)
    return branch
  },
})

// Query to get count of temporary receipts for a branch
export const getBranchReceiptCount = query({
  args: {
    branchId: v.id('branches'),
  },
  handler: async (ctx: QueryCtx, args: { branchId: Id<'branches'> }) => {
    const receipts = await ctx.db
      .query('temporaryReceipts')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()
    
    return receipts.length
  },
})

// Mutation to create a new branch
export const createBranch = mutation({
  args: {
    branchName: v.string(),
    alias: v.optional(v.string()), // Can be undefined or string (empty string means clear it)
    doNumbering: v.optional(v.string()),
    trNumbering: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: { 
    branchName: string
    alias?: string
    doNumbering?: string
    trNumbering?: string
  }) => {
    const now = Date.now()
    
    // If alias is empty string, set it to undefined so branch name is used
    const aliasValue = (args.alias === '' || args.alias === null) ? undefined : args.alias
    
    const branchId = await ctx.db.insert('branches', {
      branchName: args.branchName,
      alias: aliasValue,
      doNumbering: args.doNumbering || 'SOTP1', // Prefix only
      trNumbering: args.trNumbering,
      createdAt: now,
      updatedAt: now,
    })
    
    return branchId
  },
})

// Mutation to update a branch
export const updateBranch = mutation({
  args: {
    id: v.id('branches'),
    branchName: v.string(),
    alias: v.optional(v.string()), // Can be undefined or string (empty string means clear it)
    doNumbering: v.optional(v.string()),
    trNumbering: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: { 
    id: Id<'branches'>
    branchName: string
    alias?: string
    doNumbering?: string
    trNumbering?: string
  }) => {
    const branch = await ctx.db.get(args.id)
    
    if (!branch) {
      throw new Error('Branch not found')
    }
    
    // If alias is provided (even if empty string), use it. Empty string means clear it (set to undefined).
    // If alias is undefined, keep the existing value.
    let aliasValue: string | undefined
    if (args.alias !== undefined) {
      // Alias was explicitly provided - empty string means clear it
      aliasValue = (args.alias === '' || args.alias === null) ? undefined : args.alias
    } else {
      // Alias was not provided, keep existing
      aliasValue = branch.alias
    }
    
    await ctx.db.patch(args.id, {
      branchName: args.branchName,
      alias: aliasValue,
      doNumbering: args.doNumbering !== undefined ? args.doNumbering : (branch.doNumbering || 'SOTP1'),
      trNumbering: args.trNumbering !== undefined ? args.trNumbering : branch.trNumbering,
      updatedAt: Date.now(),
    })
    
    return args.id
  },
})

// Mutation to delete a branch
export const deleteBranch = mutation({
  args: {
    id: v.id('branches'),
    doCount: v.optional(v.number()), // Count of delivery orders (from backend API)
  },
  handler: async (ctx: MutationCtx, args: { 
    id: Id<'branches'>
    doCount?: number
  }) => {
    const branch = await ctx.db.get(args.id)
    
    if (!branch) {
      throw new Error('Branch not found')
    }
    
    // Check temporary receipts count
    const receipts = await ctx.db
      .query('temporaryReceipts')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.id))
      .collect()
    
    const receiptCount = receipts.length
    const doCount = args.doCount || 0
    
    // Prevent deletion if branch has delivery orders or temporary receipts
    if (doCount > 0 || receiptCount > 0) {
      throw new Error(
        `Cannot delete branch. It has ${doCount} delivery order(s) and ${receiptCount} temporary receipt(s).`
      )
    }
    
    await ctx.db.delete(args.id)
    
    return { success: true }
  },
})
