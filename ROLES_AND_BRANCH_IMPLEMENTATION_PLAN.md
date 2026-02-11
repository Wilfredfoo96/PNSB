# Roles and Branch System Implementation Plan

## Overview
This document outlines the step-by-step plan to implement a comprehensive roles and branch system with branch-specific numbering, access control, and filtering.

---

## Phase 1: Database Schema Updates

### Step 1.1: Update Branches Schema
**File:** `website/convex/schema.ts`

**Changes:**
- Add `trNumbering` field (Temporary Receipt numbering prefix)
- Add `alias` field (optional display name for branches)
- Ensure `doNumbering` stores only the prefix (e.g., "SOTP1" not "SOTP1-000001")

**Schema Update:**
```typescript
branches: defineTable({
  branchName: v.string(),
  alias: v.optional(v.string()), // Display name for tabs
  doNumbering: v.string(), // Prefix only (e.g., "SOTP1")
  trNumbering: v.optional(v.string()), // Prefix only (e.g., "TR1")
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Step 1.2: Add Branch Tracking to Delivery Orders
**File:** `website/convex/schema.ts` (if using Convex) or AutoCount DB

**Note:** Delivery Orders are stored in AutoCount DB, not Convex. We'll track branch via DocNo prefix pattern matching.

### Step 1.3: Add Branch Tracking to Temporary Receipts
**File:** `website/convex/schema.ts`

**Changes:**
- Add `branchId` field to `temporaryReceipts` table to track which branch created it

**Schema Update:**
```typescript
temporaryReceipts: defineTable({
  // ... existing fields
  branchId: v.optional(v.id('branches')), // Track branch
  // ... rest of fields
})
```

---

## Phase 2: Update Permissions System

### Step 2.1: Update Permissions Interface
**File:** `website/lib/permissions.ts`

**Changes:**
- Add `canAccessReports` permission
- Verify current permissions match requirements:
  - Super Admin: All access
  - Admin: All except Debugging
  - Staff: All except Settings, Users, Debugging

**Current Status:** ✅ Already correct, just need to add `canAccessReports`

### Step 2.2: Add Branch Management Permissions
**File:** `website/lib/permissions.ts`

**Changes:**
- Add `canCreateBranch` and `canDeleteBranch` permissions
- Super Admin and Admin: `true`
- Staff: `false`

---

## Phase 3: Branch Management Updates

### Step 3.1: Update Branch Schema in Convex
**File:** `website/convex/branches.ts`

**Changes:**
1. Update `createBranch` mutation to accept:
   - `alias` (optional)
   - `doNumbering` (prefix only, e.g., "SOTP1")
   - `trNumbering` (prefix only, e.g., "TR1")

2. Update `updateBranch` mutation similarly

3. Add validation:
   - Check if branch has delivery orders before allowing delete/edit
   - Query DO table for DocNo matching branch prefix pattern

### Step 3.2: Add Branch Protection Logic
**File:** `website/convex/branches.ts`

**New Query:** `getBranchDeliveryOrderCount`
- Count delivery orders by checking DocNo prefix matches branch's doNumbering
- Return count

**Update `deleteBranch` mutation:**
- Check if count > 0, throw error if branch has delivery orders
- Check temporary receipts count too

**Update `updateBranch` mutation:**
- Similar check - prevent editing if has delivery orders

### Step 3.3: Update Settings Page - Branches Tab
**File:** `website/app/dashboard/settings/page.tsx`

**Changes:**
1. Add `alias` input field
2. Add `trNumbering` input field
3. Update DO Numbering field:
   - Change label to "DO Numbering Prefix"
   - Store only prefix (e.g., "SOTP1"), not full number
   - Show example: "SOTP1 → SOTP1-000001"
4. Add validation:
   - Show warning if branch has delivery orders (disable edit/delete)
   - Display count of delivery orders per branch

5. Add permission checks:
   - Only Super Admin and Admin can create/edit/delete branches
   - Staff can only view

---

## Phase 4: Numbering System Implementation

### Step 4.1: Update DO Numbering Generation (Backend)
**File:** `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs`

**Changes:**
1. Modify `GenerateDocNoAsync` method:
   - Accept `branchPrefix` parameter (e.g., "SOTP1")
   - Generate format: `{prefix}-{sequence}` (e.g., "SOTP1-000001")
   - Query existing DOs with matching prefix to find next sequence

2. Update `CreateDeliveryOrderAsync`:
   - Get user's branch from request context or user info
   - For Staff: Use their assigned branch's `doNumbering` prefix
   - For Admin/Super Admin: Use selected branch from request

3. Add new method: `GetBranchPrefixAsync(branchId)`
   - Query branch's doNumbering prefix

### Step 4.2: Update DO Numbering (Frontend)
**File:** `website/app/dashboard/delivery-orders/page.tsx`

**Changes:**
1. Get user's branch on page load
2. For Staff: Auto-select their branch (no tabs)
3. For Admin/Super Admin: Show branch tabs at top
4. Pass selected branch to API when creating DO

### Step 4.3: Update Temporary Receipt Numbering
**File:** `website/convex/temporaryReceipts.ts`

**Changes:**
1. Add `generateReceiptNumber` function:
   - Accept branch prefix
   - Format: `{prefix}-{sequence}` (e.g., "TR1-000001")
   - Query existing receipts with matching prefix

2. Update `create` mutation:
   - Get user's branch
   - Generate receipt number using branch's `trNumbering` prefix
   - Store `branchId` in receipt record

### Step 4.4: Update Temporary Receipts Page
**File:** `website/app/dashboard/temporary-receipts/page.tsx`

**Changes:**
- Similar to DO page: branch tabs for Admin/Super Admin
- Auto-select branch for Staff

---

## Phase 5: Branch Filtering and Tabs

### Step 5.1: Create Branch Tabs Component
**File:** `website/components/dashboard/BranchTabs.tsx` (NEW)

**Features:**
- Display tabs for each branch
- Show branch alias if available, otherwise branch name
- Only visible for Admin and Super Admin
- Track selected branch in state/URL query param

### Step 5.2: Add Branch Tabs to Delivery Orders Page
**File:** `website/app/dashboard/delivery-orders/page.tsx`

**Changes:**
1. Import BranchTabs component
2. Add tabs after page header (after "Efficiently manage..." text)
3. Filter delivery orders by selected branch:
   - For Staff: Auto-filter by their branch (check DocNo prefix)
   - For Admin/Super Admin: Filter by selected tab's branch
4. Update API calls to include branch filter

### Step 5.3: Add Branch Tabs to Temporary Receipts Page
**File:** `website/app/dashboard/temporary-receipts/page.tsx`

**Changes:**
- Same as Step 5.2 but for temporary receipts
- Filter by `branchId` field in Convex

### Step 5.4: Add Branch Filtering to API Routes
**Files:**
- `website/app/api/autocount/delivery-orders-v2/route.ts`
- `website/app/api/temporary-receipts/route.ts`

**Changes:**
- Accept `branchId` or `branchPrefix` query parameter
- Filter results accordingly

---

## Phase 6: Staff Access Restrictions

### Step 6.1: Implement Staff Branch Filtering
**File:** `website/app/dashboard/delivery-orders/page.tsx`

**Logic:**
1. Get current user's branchId
2. Get branch's doNumbering prefix
3. Filter all DO queries to only show DocNo starting with that prefix
4. Hide branch tabs (Staff can't switch branches)

### Step 6.2: Implement Staff Branch Filtering for Temporary Receipts
**File:** `website/app/dashboard/temporary-receipts/page.tsx`

**Logic:**
1. Get current user's branchId
2. Filter all receipt queries by `branchId` field
3. Hide branch tabs

### Step 6.3: Update API Routes for Staff Filtering
**Files:**
- `website/app/api/autocount/delivery-orders-v2/route.ts`
- `website/app/api/temporary-receipts/route.ts`

**Changes:**
- Check user role
- If Staff: Automatically add branch filter based on user's branchId
- If Admin/Super Admin: Use branch filter from query params (if provided)

---

## Phase 7: Reports Page Creation

### Step 7.1: Create Reports Page Structure
**File:** `website/app/dashboard/reports/page.tsx` (NEW)

**Features:**
- Basic page layout
- Branch tabs (same as DO and TR pages)
- Placeholder for future reports

### Step 7.2: Add Reports to Sidebar
**File:** `website/components/dashboard/ModernSidebar.tsx`

**Changes:**
- Add "Reports" menu item after "Inventory"
- Icon: `assessment` or `bar_chart`
- Link: `/dashboard/reports`

### Step 7.3: Add Reports Permission Check
**File:** `website/lib/permissions.ts`

**Changes:**
- Add `canAccessReports: true` for all roles (or restrict as needed)

---

## Phase 8: Branch Alias Implementation

### Step 8.1: Update Branch Schema (Already in Phase 1)
✅ Completed in Phase 1.1

### Step 8.2: Update Branch Forms
**File:** `website/app/dashboard/settings/page.tsx`

**Changes:**
- Add "Alias" input field next to "Branch Name"
- Optional field
- Save to `alias` field in branch record

### Step 8.3: Update Branch Tabs Component
**File:** `website/components/dashboard/BranchTabs.tsx`

**Changes:**
- Display `branch.alias || branch.branchName` in tabs
- Use alias if available, fallback to branchName

---

## Phase 9: Backend API Updates

### Step 9.1: Update Delivery Order Creation API
**File:** `autocount-api/AutoCountApi/Controllers/DeliveryOrderController.cs`

**Changes:**
1. Accept `branchId` or `branchPrefix` in request
2. Get user's branch if Staff
3. Pass branch prefix to `GenerateDocNoAsync`

### Step 9.2: Update Delivery Order Service
**File:** `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs`

**Changes:**
1. Modify `GenerateDocNoAsync`:
   ```csharp
   private async Task<string> GenerateDocNoAsync(string prefix)
   {
       // prefix is like "SOTP1" (not "DO-")
       // Format: {prefix}-{sequence}
       // Query: WHERE DocNo LIKE '{prefix}-%'
       // Find max sequence, increment
   }
   ```

2. Update `CreateDeliveryOrderAsync`:
   - Get branch prefix from user or request
   - Call `GenerateDocNoAsync(prefix)`

### Step 9.3: Add Branch Info to User Context
**File:** `autocount-api/AutoCountApi/` (wherever user context is handled)

**Changes:**
- Include user's branchId in API requests
- Or query user's branch from Convex when needed

---

## Phase 10: Testing and Validation

### Step 10.1: Test Branch Creation/Deletion
- ✅ Create branch without DOs → Should allow delete
- ✅ Create branch with DOs → Should prevent delete
- ✅ Edit branch without DOs → Should allow
- ✅ Edit branch with DOs → Should prevent

### Step 10.2: Test Numbering System
- ✅ Staff creates DO → Uses their branch prefix
- ✅ Admin creates DO → Uses selected branch prefix
- ✅ Numbering increments correctly per branch
- ✅ TR numbering works similarly

### Step 10.3: Test Access Control
- ✅ Staff can only see their branch's data
- ✅ Admin can see all branches via tabs
- ✅ Super Admin can see all branches via tabs
- ✅ Staff cannot access Settings, Users, Debugging
- ✅ Admin cannot access Debugging

### Step 10.4: Test Branch Tabs
- ✅ Tabs show alias if available
- ✅ Tabs show branch name if no alias
- ✅ Switching tabs filters data correctly
- ✅ Staff don't see tabs

---

## Implementation Order Summary

1. **Phase 1**: Database Schema (Foundation)
2. **Phase 2**: Permissions (Access Control)
3. **Phase 3**: Branch Management (CRUD + Protection)
4. **Phase 4**: Numbering System (DO & TR)
5. **Phase 5**: Branch Tabs UI (Filtering UI)
6. **Phase 6**: Staff Restrictions (Data Filtering)
7. **Phase 7**: Reports Page (New Feature)
8. **Phase 8**: Branch Alias (Enhancement)
9. **Phase 9**: Backend API (Integration)
10. **Phase 10**: Testing (Validation)

---

## Key Files to Modify

### Frontend (Next.js/React)
- `website/lib/permissions.ts` - Permissions system
- `website/convex/schema.ts` - Database schema
- `website/convex/branches.ts` - Branch mutations/queries
- `website/convex/temporaryReceipts.ts` - TR numbering
- `website/app/dashboard/settings/page.tsx` - Branch management UI
- `website/app/dashboard/delivery-orders/page.tsx` - DO page with tabs
- `website/app/dashboard/temporary-receipts/page.tsx` - TR page with tabs
- `website/app/dashboard/reports/page.tsx` - NEW Reports page
- `website/components/dashboard/ModernSidebar.tsx` - Add Reports menu
- `website/components/dashboard/BranchTabs.tsx` - NEW Component

### Backend (C# .NET)
- `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs` - DO numbering
- `autocount-api/AutoCountApi/Controllers/DeliveryOrderController.cs` - Branch handling
- `autocount-api/AutoCountApi/Models/DeliveryOrder.cs` - Request models

### API Routes
- `website/app/api/autocount/delivery-orders-v2/route.ts` - Branch filtering
- `website/app/api/temporary-receipts/route.ts` - Branch filtering

---

## Notes and Considerations

1. **DO Numbering Format Change:**
   - Current: `DO-000001`
   - New: `{prefix}-{sequence}` (e.g., `SOTP1-000001`)
   - Need to handle existing DOs with old format

2. **Branch Prefix Storage:**
   - Store only prefix (e.g., "SOTP1") in `doNumbering` field
   - Generate full number (e.g., "SOTP1-000001") when creating DO

3. **Branch Detection from DocNo:**
   - For existing DOs, extract prefix from DocNo
   - Match against branch's doNumbering to determine branch

4. **User Branch Assignment:**
   - Already implemented in users table (`branchId` field)
   - Use this for Staff filtering

5. **Concurrent Numbering:**
   - Ensure thread-safe numbering generation
   - Use database transactions or locks

6. **Migration:**
   - Existing DOs may have "DO-" prefix
   - Consider migration script or handle both formats

---

## Estimated Timeline

- **Phase 1-2**: 2-3 hours (Schema + Permissions)
- **Phase 3**: 3-4 hours (Branch Management)
- **Phase 4**: 4-5 hours (Numbering System)
- **Phase 5**: 2-3 hours (Branch Tabs UI)
- **Phase 6**: 2-3 hours (Staff Filtering)
- **Phase 7**: 1-2 hours (Reports Page)
- **Phase 8**: 1 hour (Branch Alias)
- **Phase 9**: 3-4 hours (Backend API)
- **Phase 10**: 2-3 hours (Testing)

**Total Estimated Time: 20-28 hours**

---

## Questions to Clarify

1. Should existing DOs with "DO-" prefix be migrated or left as-is?
2. What happens if a Staff user has no branch assigned?
3. Should branch tabs remember last selected branch (localStorage)?
4. What reports should be included in the Reports page initially?
5. Should branch deletion be soft-delete or hard-delete?
