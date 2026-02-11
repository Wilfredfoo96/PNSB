# Roles and Branch Implementation - Quick Checklist

## ✅ Phase 1: Database Schema (Foundation)
- [ ] Add `alias` field to branches schema
- [ ] Add `trNumbering` field to branches schema  
- [ ] Change `doNumbering` to store prefix only (e.g., "SOTP1" not "SOTP1-000001")
- [ ] Add `branchId` to temporaryReceipts schema
- [ ] Update branches mutations to handle new fields

## ✅ Phase 2: Permissions
- [ ] Add `canAccessReports` permission
- [ ] Add `canCreateBranch` and `canDeleteBranch` permissions
- [ ] Verify role permissions match requirements

## ✅ Phase 3: Branch Management
- [ ] Add branch protection query (check DO count)
- [ ] Prevent delete/edit if branch has delivery orders
- [ ] Update Settings page with alias and TR numbering fields
- [ ] Add permission checks (only Admin/Super Admin can manage)

## ✅ Phase 4: Numbering System
- [ ] Update DO numbering to use branch prefix format: `{prefix}-{sequence}`
- [ ] Update backend `GenerateDocNoAsync` to accept prefix parameter
- [ ] Implement TR numbering with branch prefix
- [ ] Get user's branch when creating DO/TR
- [ ] For Staff: Auto-use their branch prefix
- [ ] For Admin/Super Admin: Use selected branch prefix

## ✅ Phase 5: Branch Tabs UI
- [ ] Create `BranchTabs.tsx` component
- [ ] Add tabs to Delivery Orders page (after header)
- [ ] Add tabs to Temporary Receipts page
- [ ] Show alias if available, otherwise branch name
- [ ] Only show tabs for Admin/Super Admin

## ✅ Phase 6: Staff Filtering
- [ ] Filter DO list by branch prefix for Staff
- [ ] Filter TR list by branchId for Staff
- [ ] Hide branch tabs for Staff
- [ ] Auto-select Staff's branch (no switching)

## ✅ Phase 7: Reports Page
- [ ] Create `/dashboard/reports` page
- [ ] Add Reports to sidebar menu
- [ ] Add branch tabs to Reports page
- [ ] Implement basic reports structure

## ✅ Phase 8: Branch Alias
- [ ] Add alias input in Settings > Branches
- [ ] Update BranchTabs to show alias
- [ ] Save/load alias from database

## ✅ Phase 9: Backend API
- [ ] Update DO creation API to accept branch info
- [ ] Update DO service to use branch prefix
- [ ] Add branch filtering to DO list API
- [ ] Add branch filtering to TR list API

## ✅ Phase 10: Testing
- [ ] Test branch create/delete protection
- [ ] Test DO numbering per branch
- [ ] Test TR numbering per branch
- [ ] Test Staff access restrictions
- [ ] Test Admin/Super Admin branch switching
- [ ] Test branch alias display

---

## Quick Reference: File Changes

### Must Modify:
1. `website/convex/schema.ts` - Add alias, trNumbering, branchId
2. `website/lib/permissions.ts` - Add reports permission
3. `website/convex/branches.ts` - Add protection logic
4. `website/app/dashboard/settings/page.tsx` - Add alias/TR fields
5. `autocount-api/.../DeliveryOrderService.cs` - Update numbering
6. `website/app/dashboard/delivery-orders/page.tsx` - Add tabs & filtering
7. `website/app/dashboard/temporary-receipts/page.tsx` - Add tabs & filtering

### New Files:
1. `website/components/dashboard/BranchTabs.tsx` - Branch tabs component
2. `website/app/dashboard/reports/page.tsx` - Reports page
