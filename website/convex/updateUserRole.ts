import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Simple mutation to update only the role field
 * Use this if you're having issues with the full upsertUser mutation
 */
export const updateUserRole = mutation({
  args: {
    clerkId: v.string(),
    role: v.string(), // Accept any string - validation happens in handler
  },
  handler: async (ctx, args) => {
    // Validate role
    const validRoles = ['super_admin', 'admin', 'staff']
    if (!validRoles.includes(args.role)) {
      throw new Error(`Invalid role: ${args.role}. Must be one of: ${validRoles.join(', ')}`)
    }

    // Find user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found`)
    }

    // Update role
    await ctx.db.patch(user._id, {
      role: args.role,
      updatedAt: Date.now(),
    })

    return { success: true, role: args.role }
  },
})
