import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

// Query to list temporary receipts with pagination
export const list = query({
  args: {
    page: v.number(),
    limit: v.number(),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    branchId: v.optional(v.id('branches')), // Filter by branch
  },
  handler: async (ctx, args) => {
    const { page, limit, search, status, branchId } = args
    const offset = (page - 1) * limit

    let receipts = await ctx.db.query('temporaryReceipts').collect()
    
    // Filter by branch if provided
    if (branchId) {
      receipts = receipts.filter((r) => r.branchId === branchId)
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      receipts = receipts.filter(
        (r) =>
          r.docNo.toLowerCase().includes(searchLower) ||
          r.debtorCode.toLowerCase().includes(searchLower) ||
          (r.description && r.description.toLowerCase().includes(searchLower))
      )
    }

    // Apply status filter
    if (status) {
      if (status === 'cancelled') {
        receipts = receipts.filter((r) => r.cancelled === 'Y')
      } else if (status === 'active') {
        receipts = receipts.filter((r) => r.cancelled === 'N')
      } else if (status === 'paid') {
        receipts = receipts.filter(
          (r) => (r.outstanding || 0) <= 0 && r.cancelled === 'N'
        )
      } else if (status === 'unpaid') {
        receipts = receipts.filter(
          (r) => (r.outstanding || 0) > 0 && r.cancelled === 'N'
        )
      }
    }

    // Sort by date descending
    receipts.sort((a, b) => {
      const dateA = new Date(a.docDate).getTime()
      const dateB = new Date(b.docDate).getTime()
      return dateB - dateA
    })

    const total = receipts.length
    const paginatedReceipts = receipts.slice(offset, offset + limit)

    return {
      data: paginatedReceipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  },
})

// Query to get a single temporary receipt with line items
export const get = query({
  args: {
    receiptId: v.id('temporaryReceipts'),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId)
    if (!receipt) {
      return null
    }

    const lineItems = await ctx.db
      .query('temporaryReceiptLineItems')
      .withIndex('by_receipt_id', (q) => q.eq('receiptId', args.receiptId))
      .collect()

    // Sort line items by sequence
    lineItems.sort((a, b) => a.seq - b.seq)

    return {
      ...receipt,
      lineItems,
    }
  },
})

// Query to get receipt by docNo
export const getByDocNo = query({
  args: {
    docNo: v.string(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db
      .query('temporaryReceipts')
      .withIndex('by_doc_no', (q) => q.eq('docNo', args.docNo))
      .first()

    if (!receipt) {
      return null
    }

    const lineItems = await ctx.db
      .query('temporaryReceiptLineItems')
      .withIndex('by_receipt_id', (q) => q.eq('receiptId', receipt._id))
      .collect()

    lineItems.sort((a, b) => a.seq - b.seq)

    return {
      ...receipt,
      lineItems,
    }
  },
})

// Query to get next receipt number for a branch (for display when creating)
export const getNextReceiptNumber = query({
  args: {
    branchId: v.optional(v.id('branches')),
  },
  handler: async (ctx, args) => {
    let prefix = 'TR'
    if (args.branchId) {
      const branch = await ctx.db.get(args.branchId)
      if (branch?.trNumbering) {
        prefix = branch.trNumbering
      } else if (branch?.doNumbering) {
        prefix = branch.doNumbering.replace(/DO/i, 'TR').replace(/SOTP/i, 'TR')
      }
    }
    const allReceipts = await ctx.db.query('temporaryReceipts').collect()
    let nextSeq = 1
    for (const receipt of allReceipts) {
      if (receipt.docNo.startsWith(`${prefix}-`)) {
        const seqPart = receipt.docNo.substring(prefix.length + 1)
        if (/^\d+$/.test(seqPart)) {
          const seq = parseInt(seqPart, 10)
          if (seq >= nextSeq) nextSeq = seq + 1
        }
      }
    }
    return { nextDocNo: `${prefix}-${nextSeq.toString().padStart(6, '0')}` }
  },
})

// Mutation to create a temporary receipt
export const create = mutation({
  args: {
    header: v.object({
      docNo: v.optional(v.string()), // Optional - will be auto-generated if not provided
      docDate: v.string(),
      paymentDate: v.string(), // Renamed from dueDate
      debtorCode: v.string(),
      description: v.optional(v.string()),
      salesAgent: v.optional(v.string()),
      currencyCode: v.string(), // Always 'MYR'
      currencyRate: v.number(), // Always 1
      toTaxCurrencyRate: v.optional(v.number()),
      inclusiveTax: v.optional(v.string()),
      roundingMethod: v.optional(v.number()),
      withholdingTaxVersion: v.optional(v.number()),
      withholdingTaxRoundingMethod: v.optional(v.number()),
      cancelled: v.optional(v.string()),
      docStatus: v.optional(v.string()),
      lastModifiedUserID: v.string(),
      createdUserID: v.string(),
      createdByName: v.optional(v.string()), // Creator display name
      paymentMethod: v.optional(v.string()), // Payment method
      priceCharge: v.optional(v.number()), // Price to charge
      priceReceive: v.optional(v.number()), // Price received
      remark: v.optional(v.string()), // Additional remarks
      branchId: v.optional(v.id('branches')), // Branch ID for numbering
    }),
    lineItems: v.optional(
      v.array(
        v.object({
          seq: v.number(),
          accNo: v.optional(v.string()),
          toAccountRate: v.optional(v.number()),
          description: v.optional(v.string()),
          projNo: v.optional(v.string()),
          deptNo: v.optional(v.string()),
          taxCode: v.optional(v.string()),
          tax: v.optional(v.number()),
          localTax: v.optional(v.number()),
          amount: v.optional(v.number()),
          netAmount: v.optional(v.number()),
          localNetAmount: v.optional(v.number()),
          taxableAmt: v.optional(v.number()),
          subTotal: v.optional(v.number()),
          localSubTotal: v.optional(v.number()),
          taxRate: v.optional(v.number()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { header, lineItems = [] } = args

    // Generate docNo if not provided
    let docNo = header.docNo
    if (!docNo) {
      // Get branch prefix
      let prefix = 'TR' // Default prefix
      if (header.branchId) {
        const branch = await ctx.db.get(header.branchId)
        if (branch?.trNumbering) {
          prefix = branch.trNumbering
        } else if (branch?.doNumbering) {
          // Fallback to DO numbering if TR numbering not set
          prefix = branch.doNumbering.replace(/DO/i, 'TR').replace(/SOTP/i, 'TR')
        }
      }

      // Find the maximum sequence number for this prefix
      const allReceipts = await ctx.db.query('temporaryReceipts').collect()
      let nextSeq = 1
      
      for (const receipt of allReceipts) {
        if (receipt.docNo.startsWith(`${prefix}-`)) {
          const seqPart = receipt.docNo.substring(prefix.length + 1)
          if (/^\d+$/.test(seqPart)) {
            const seq = parseInt(seqPart, 10)
            if (seq >= nextSeq) {
              nextSeq = seq + 1
            }
          }
        }
      }

      // Check for uniqueness (race condition protection)
      let candidateDocNo: string
      let attempts = 0
      do {
        candidateDocNo = `${prefix}-${nextSeq.toString().padStart(6, '0')}`
        const existing = await ctx.db
          .query('temporaryReceipts')
          .withIndex('by_doc_no', (q) => q.eq('docNo', candidateDocNo))
          .first()
        
        if (!existing) {
          docNo = candidateDocNo
          break
        }
        
        nextSeq++
        attempts++
        if (attempts > 100) {
          throw new Error('Unable to generate unique DocNo after 100 attempts')
        }
      } while (true)
    } else {
      // Check if provided docNo already exists
      if (!docNo) {
        throw new Error('DocNo is required')
      }
      const docNoString: string = docNo // Type assertion
      const existing = await ctx.db
        .query('temporaryReceipts')
        .withIndex('by_doc_no', (q) => q.eq('docNo', docNoString))
        .first()

      if (existing) {
        throw new Error('Receipt with this DocNo already exists')
      }
    }

    const now = new Date().toISOString()

    // Create receipt header
    const receiptId = await ctx.db.insert('temporaryReceipts', {
      docNo: docNo,
      docDate: header.docDate,
      paymentDate: header.paymentDate, // Renamed from dueDate
      debtorCode: header.debtorCode,
      description: header.description,
      salesAgent: header.salesAgent,
      currencyCode: 'MYR', // Always MYR
      currencyRate: 1, // Always 1
      toTaxCurrencyRate: 1, // Always 1
      total: 0,
      localTotal: 0,
      tax: 0,
      localTax: 0,
      netTotal: 0,
      localNetTotal: 0,
      paymentAmt: 0,
      localPaymentAmt: 0,
      outstanding: 0,
      cancelled: header.cancelled || 'N',
      docStatus: header.docStatus || 'O',
      inclusiveTax: header.inclusiveTax || 'N',
      roundingMethod: header.roundingMethod || 0,
      withholdingTaxVersion: header.withholdingTaxVersion || 0,
      withholdingTaxRoundingMethod: header.withholdingTaxRoundingMethod || 0,
      lastModified: now,
      lastModifiedUserID: header.lastModifiedUserID,
      createdTimeStamp: now,
      createdUserID: header.createdUserID,
      createdByName: header.createdByName || header.createdUserID, // Creator name
      paymentMethod: header.paymentMethod,
      priceCharge: header.priceCharge,
      priceReceive: header.priceReceive,
      remark: header.remark,
      branchId: header.branchId,
    })

    // Create line items
    for (const item of lineItems) {
      await ctx.db.insert('temporaryReceiptLineItems', {
        receiptId,
        seq: item.seq,
        accNo: item.accNo,
        toAccountRate: item.toAccountRate || 1,
        description: item.description,
        projNo: item.projNo,
        deptNo: item.deptNo,
        taxCode: item.taxCode,
        tax: item.tax || 0,
        localTax: item.localTax || 0,
        amount: item.amount || 0,
        netAmount: item.netAmount || 0,
        localNetAmount: item.localNetAmount || 0,
        taxableAmt: item.taxableAmt || 0,
        subTotal: item.subTotal || 0,
        localSubTotal: item.localSubTotal || 0,
        taxRate: item.taxRate || 0,
      })
    }

    return receiptId
  },
})

// Mutation to update a temporary receipt
export const update = mutation({
  args: {
    receiptId: v.id('temporaryReceipts'),
    header: v.optional(
      v.object({
        description: v.optional(v.string()),
        salesAgent: v.optional(v.string()),
        paymentDate: v.optional(v.string()), // Renamed from dueDate
        currencyCode: v.optional(v.string()),
        currencyRate: v.optional(v.number()),
        toTaxCurrencyRate: v.optional(v.number()),
        paymentMethod: v.optional(v.string()),
        priceCharge: v.optional(v.number()),
        priceReceive: v.optional(v.number()),
        remark: v.optional(v.string()),
      })
    ),
    lineItems: v.optional(
      v.array(
        v.object({
          seq: v.number(),
          accNo: v.optional(v.string()),
          toAccountRate: v.optional(v.number()),
          description: v.optional(v.string()),
          projNo: v.optional(v.string()),
          deptNo: v.optional(v.string()),
          taxCode: v.optional(v.string()),
          tax: v.optional(v.number()),
          localTax: v.optional(v.number()),
          amount: v.optional(v.number()),
          netAmount: v.optional(v.number()),
          localNetAmount: v.optional(v.number()),
          taxableAmt: v.optional(v.number()),
          subTotal: v.optional(v.number()),
          localSubTotal: v.optional(v.number()),
          taxRate: v.optional(v.number()),
        })
      )
    ),
    lastModifiedUserID: v.string(),
  },
  handler: async (ctx, args) => {
    const { receiptId, header, lineItems, lastModifiedUserID } = args

    const receipt = await ctx.db.get(receiptId)
    if (!receipt) {
      throw new Error('Receipt not found')
    }

    if (receipt.cancelled === 'Y') {
      throw new Error('Cannot update cancelled receipt')
    }

    const now = new Date().toISOString()

    // Update header if provided
    if (header) {
      await ctx.db.patch(receiptId, {
        ...header,
        lastModified: now,
        lastModifiedUserID,
      })
    }

    // Update line items if provided
    if (lineItems) {
      // Delete existing line items
      const existingItems = await ctx.db
        .query('temporaryReceiptLineItems')
        .withIndex('by_receipt_id', (q) => q.eq('receiptId', receiptId))
        .collect()

      for (const item of existingItems) {
        await ctx.db.delete(item._id)
      }

      // Insert new line items
      for (const item of lineItems) {
        await ctx.db.insert('temporaryReceiptLineItems', {
          receiptId,
          seq: item.seq,
          accNo: item.accNo,
          toAccountRate: item.toAccountRate || 1,
          description: item.description,
          projNo: item.projNo,
          deptNo: item.deptNo,
          taxCode: item.taxCode,
          tax: item.tax || 0,
          localTax: item.localTax || 0,
          amount: item.amount || 0,
          netAmount: item.netAmount || 0,
          localNetAmount: item.localNetAmount || 0,
          taxableAmt: item.taxableAmt || 0,
          subTotal: item.subTotal || 0,
          localSubTotal: item.localSubTotal || 0,
          taxRate: item.taxRate || 0,
        })
      }
    }

    return receiptId
  },
})

// Mutation to delete a temporary receipt
export const remove = mutation({
  args: {
    receiptId: v.id('temporaryReceipts'),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId)
    if (!receipt) {
      throw new Error('Receipt not found')
    }

    // Delete line items first
    const lineItems = await ctx.db
      .query('temporaryReceiptLineItems')
      .withIndex('by_receipt_id', (q) => q.eq('receiptId', args.receiptId))
      .collect()

    for (const item of lineItems) {
      await ctx.db.delete(item._id)
    }

    // Delete receipt
    await ctx.db.delete(args.receiptId)

    return { success: true }
  },
})

