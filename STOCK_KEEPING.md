# Full-Fledged Stock Keeping System — Design

This document describes how to design and implement a **complete stock keeping system** for PNSB. **Current implementation:** all branches share the same (global) stock — one quantity per item, stored in `stockKeeping`. The design below also covers a possible future **per-branch** model with movement history.

---

## 1. Goals

**Current (live):** **Shared stock** — All branches use one global quantity per product (`stockKeeping`). DO create deducts from it; DO void restores to it; manual edits on the Stock Keeping page update it.

**Optional future:** **Per-branch stock** — Each branch has its own on-hand quantity per product (see data model and phases below).
- **Full audit trail** — Every change (in/out) is a **movement** with type, reference (e.g. DO), user, and timestamp.
- **Controlled flows** — Delivery orders deduct from the correct branch; void restores; manual adjustments and stock takes create movements with a reason.
- **Optional extras** — Reservations for DOs, branch-to-branch transfers, reorder points, and (optionally) sync or reconciliation with AutoCount.

---

## 2. Data Model

### 2.1 Stock balance (current quantity per item per branch)

**Table: `stockBalances`** (replaces or extends current single `stockKeeping`)

| Field            | Type              | Description |
|------------------|-------------------|-------------|
| `branchId`       | `Id<'branches'>`  | Branch (warehouse/location). |
| `itemCode`       | string            | Product item code (AutoCount). |
| `quantityOnHand`  | number            | Physical on-hand quantity (after all movements). |
| `quantityReserved`| number            | Reserved for open DOs (optional; 0 if no reservation). |
| `lastMovementAt` | number            | Timestamp of last movement affecting this balance. |
| `lastMovementBy`  | string            | User ID of last movement. |
| `remarks`         | string?           | Optional standing remark for this balance (e.g. location, condition, notes). |

**Derived:** `availableToSell = quantityOnHand - quantityReserved` (or same as on-hand if no reservation).

**Indexes:**  
`by_branch` (`branchId`),  
`by_branch_item` (`branchId`, `itemCode`) — unique per (branch, item).

- One row per **(branch, itemCode)**.  
- Quantity is **never** updated directly; it is always the result of **stock movements**.

### 2.2 Stock movements (audit trail)

**Table: `stockMovements`**

| Field           | Type              | Description |
|-----------------|-------------------|-------------|
| `branchId`      | `Id<'branches'>`  | Branch where stock changed. |
| `itemCode`      | string            | Product item code. |
| `quantityDelta` | number            | Change: positive = in, negative = out. |
| `quantityAfter` | number            | Balance after this movement (for that branch/item). |
| `movementType`  | string            | See movement types below. |
| `referenceType` | string?           | e.g. `DELIVERY_ORDER`, `STOCK_TAKE`, `TRANSFER`, `ADJUSTMENT`, `GOODS_RECEIPT`. |
| `referenceId`   | string?           | e.g. DO DocKey, stock take batch ID, transfer batch ID. |
| `userId`        | string            | Who performed the action. |
| `createdAt`     | number            | Timestamp. |
| `notes`         | string?           | **Remarks** for this movement (reason, comment, or reference detail). |

**Indexes:**  
`by_branch` (`branchId`),  
`by_branch_item` (`branchId`, `itemCode`),  
`by_branch_created` (`branchId`, `createdAt`),  
`by_reference` (`referenceType`, `referenceId`).

**Movement types (examples)**

| Type            | Meaning | referenceType   | referenceId example |
|-----------------|--------|------------------|---------------------|
| `DO_OUT`        | DO created; stock out | DELIVERY_ORDER | DocKey |
| `DO_VOID_IN`    | DO voided; stock back | DELIVERY_ORDER | DocKey |
| `GOODS_RECEIPT` | Purchase / receipt in | GOODS_RECEIPT | Receipt doc no |
| `ADJUSTMENT`    | Manual adjust (in/out) | ADJUSTMENT | Adjustment batch id |
| `STOCK_TAKE`    | Stock take variance   | STOCK_TAKE | Stock take batch id |
| `TRANSFER_OUT`  | Transfer out (to another branch) | TRANSFER | Transfer batch id |
| `TRANSFER_IN`   | Transfer in (from another branch) | TRANSFER | Transfer batch id |

Every **in** creates a movement with `quantityDelta > 0`; every **out** with `quantityDelta < 0`. Balance is updated in the same transaction as inserting the movement.

### 2.2.1 Remarks

- **Per balance:** `stockBalances.remarks` — optional standing text for that branch/item (e.g. "Shelf A1", "Damaged area", "Under recount"). Shown on the balances list and editable when maintaining the balance (e.g. manual adjustment or stock take).
- **Per movement:** `stockMovements.notes` — remark for that single transaction (e.g. "Correction for wrong count", "DO remark", transfer reason). Shown in the movement history and when recording adjustments, stock takes, transfers, or goods receipt.

So remarks exist at both **balance level** (ongoing note) and **movement level** (reason for that change).

### 2.3 Optional: Reservations (for DOs)

**Table: `stockReservations`**

| Field       | Type              | Description |
|------------|-------------------|-------------|
| `branchId` | `Id<'branches'>`  | Branch. |
| `itemCode` | string            | Product. |
| `quantity` | number            | Reserved qty. |
| `referenceType` | string         | e.g. `DELIVERY_ORDER`. |
| `referenceId`   | string         | e.g. DocKey. |
| `userId`   | string            | Who created. |
| `createdAt`| number            | When. |
| `expiresAt`| number?           | Optional expiry. |

When a DO is created: either **reserve** (add to `quantityReserved` and insert row here) or **deduct immediately** (movement `DO_OUT` only). When DO is voided: release reservation or restore via `DO_VOID_IN`. Design choice: start with **direct deduction** (no reservation table) and add reservations in a later phase if needed.

### 2.4 Optional: Reorder settings (min/max per branch/item)

**Table: `stockReorderSettings`**

| Field        | Type              | Description |
|-------------|-------------------|-------------|
| `branchId`  | `Id<'branches'>`  | Branch. |
| `itemCode`  | string            | Product. |
| `minLevel`  | number            | Alert or block below this. |
| `maxLevel`  | number?           | Target for replenishment. |
| `reorderPoint` | number?        | Trigger reorder at this level. |
| `updatedAt` | number            | Last change. |

Used for **reorder report** and optional **hard block** when creating DOs below min.

---

## 3. Flows (How Stock Changes)

### 3.1 Delivery order created

1. **Input:** DO lines (itemCode, qty) and **branchId** (branch that owns the DO).
2. **Validation (recommended):** For each line, check `stockBalances.quantityOnHand` (or `availableToSell`) for that branch/item. If insufficient, either:
   - **Block** DO creation and return error, or  
   - **Allow** and optionally flag (e.g. allow negative for backorders).
3. **Mutation (single Convex transaction):** For each line:
   - Insert `stockMovements`: `movementType = DO_OUT`, `quantityDelta = -qty`, `referenceType = DELIVERY_ORDER`, `referenceId = DocKey`.
   - Update `stockBalances`: same branch/item, `quantityOnHand -= qty`, set `lastMovementAt` / `lastMovementBy`.
4. **Idempotency:** Use (referenceType, referenceId, itemCode) to avoid double deduction (e.g. skip if movement already exists for this DO and item).

### 3.2 Delivery order voided

1. **Input:** DO DocKey (and branchId from `deliveryOrderBranches`).
2. **Lookup:** DO lines (itemCode, qty) from stored DO data or API.
3. **Mutation:** For each line:
   - Insert `stockMovements`: `movementType = DO_VOID_IN`, `quantityDelta = +qty`, same reference.
   - Update `stockBalances`: `quantityOnHand += qty`.
4. **Idempotency:** Skip if restore already applied for this DO/item.

### 3.3 Manual adjustment

1. **Input:** branchId, itemCode, quantityDelta (positive or negative), userId, notes (remarks for the movement), optional remarks for the balance.
2. **Optional:** Enforce non-negative on-hand (reject if adjustment would make balance &lt; 0).
3. **Mutation:** Insert movement `ADJUSTMENT` with `notes` set to the remark; update `stockBalances.quantityOnHand += quantityDelta`; optionally update `stockBalances.remarks` if provided.

### 3.4 Stock take (cycle count / physical count)

1. **Input:** branchId, list of { itemCode, countedQuantity }, optional remarks (batch or per-line; stored on movements).
2. **Process:**
   - For each item, read current `quantityOnHand` from `stockBalances` (expected).
   - Variance = countedQuantity - expected.
   - If variance ≠ 0: insert movement `STOCK_TAKE`, `quantityDelta = variance`, `notes` = remark (e.g. reason or batch note), update balance.
3. **Reference:** One stock take “batch” (e.g. ID) so all movements link to same `referenceId`. Optional: status (Draft / Approved) and approver for large variances.

### 3.5 Branch-to-branch transfer

1. **Input:** fromBranchId, toBranchId, lines: { itemCode, quantity }.
2. **Validation:** Check sufficient on-hand at source branch per item.
3. **Mutation (one transaction):**
   - For each line: movement **OUT** at fromBranchId (`TRANSFER_OUT`), movement **IN** at toBranchId (`TRANSFER_IN`), same `referenceId` (transfer batch).
   - Update both branches’ `stockBalances`.

### 3.6 Goods receipt (purchase / receiving)

1. **Input:** branchId, lines: { itemCode, quantity }, reference (e.g. PO or receipt number).
2. **Mutation:** For each line: insert movement `GOODS_RECEIPT`, `quantityDelta = +quantity`, update balance.

---

## 4. API Design (Convex)

### 4.1 Queries

| Query | Args | Purpose |
|-------|------|--------|
| `getBalancesByBranch` | branchId, itemCode? | List balances for branch (optional filter by item). |
| `getBalance` | branchId, itemCode | Single balance (or 0). |
| `getMovements` | branchId, itemCode?, fromTime?, toTime?, limit? | Movement history for reporting/audit. |
| `getReorderReport` | branchId? | Items at or below reorder point (if reorder settings exist). |

### 4.2 Mutations (all must run in a single transaction per business operation)

| Mutation | Args | Purpose |
|----------|------|--------|
| `deductForDeliveryOrder` | branchId, docKey, lines[], userId | DO created: movements OUT, update balances. |
| `restoreForDeliveryOrderVoid` | branchId, docKey, lines[], userId | DO voided: movements IN, update balances. |
| `adjustStock` | branchId, itemCode, quantityDelta, userId, notes? (movement remark), balanceRemarks? | Manual adjustment. |
| `recordStockTake` | branchId, lines[{ itemCode, countedQty }], userId, notes? | Stock take adjustments. |
| `createTransfer` | fromBranchId, toBranchId, lines[], userId, notes? | Inter-branch transfer. |
| `recordGoodsReceipt` | branchId, lines[], referenceId?, userId, notes? | Goods in. |

**Initialization:** Provide a mutation or script to **seed** `stockBalances` from current data (e.g. current `stockKeeping` mapped to a default branch, or import from AutoCount).

---

## 5. Integration with Existing App

### 5.1 Branches and DOs

- **DO creation (API):** Already has `branchId` (or can be derived from user/session). Call `deductForDeliveryOrder(branchId, docKey, lines, userId)` after DO is saved in AutoCount. If Convex is source of truth for stock, **fail the DO create** if deduction fails (e.g. insufficient stock when policy is “block”).
- **DO void (API):** Resolve branch from `deliveryOrderBranches` by DocKey; call `restoreForDeliveryOrderVoid(branchId, docKey, lines, userId)`.

### 5.2 Products

- Product list and item codes still come from **AutoCount** (Products API). Stock UI merges products with `stockBalances` (and optionally `stockMovements`) per branch.

### 5.3 AutoCount sync (optional)

- **Option A — Convex as source of truth:** App does not write stock back to AutoCount; use AutoCount for GL/costing only, and keep operational stock in Convex.
- **Option B — Periodic sync:** Job (e.g. nightly) reads AutoCount stock by location/branch (if supported) and overwrites or reconciles Convex balances; or export Convex movements and import into AutoCount.
- **Option C — Reconciliation only:** Keep both; run a report that compares Convex balance vs AutoCount balance per branch/item and highlight variances for manual resolution.

Choose based on whether AutoCount is the master for inventory or the app is.

---

## 6. UI Behaviour (Stock Keeping Page)

### 6.1 Branch scope

- **Branch selector:** User picks a branch (or “All” for admins). Table shows balances (and optional movements) for selected branch(es).
- **Role/branch:** Staff may be restricted to their assigned branch; admins see all branches.

### 6.2 Main views

1. **Balances:** Table columns — Branch, Item Code, Description (from products), On Hand, Reserved (if used), Available, **Remarks**, Last Movement, Last Updated By. Filter by branch, search by item/description. Remarks editable (e.g. inline or via edit).
2. **Movements:** List movements for branch (and optional item/date range). Columns: Date, Item, Type, In, Out, Balance After, Reference, User, **Remarks** (notes).
3. **Adjustment:** Form: Branch, Item (search/select), Quantity delta (+/-), **Remarks** (for this adjustment; stored as movement notes). Optional: update balance remarks. Submit calls `adjustStock`.
4. **Stock take:** Upload or enter counted quantities per item; submit calls `recordStockTake`; show expected vs actual and variances before confirm.
5. **Transfer:** Form: From branch, To branch, Line items (itemCode, qty). Submit calls `createTransfer`.
6. **Reorder report (optional):** Table of items where on-hand ≤ reorder point (or &lt; min), with reorder suggestion (e.g. order up to max).

### 6.3 Permissions

- **View balances / movements:** Any user with access to Stock Keeping; filter by branch according to role.
- **Adjust, stock take, transfer, goods receipt:** Restrict to roles with a permission (e.g. `canManageStock` or `canAccessSettings`). Optionally require approval for large adjustments or stock take variances above a threshold.

---

## 7. Implementation Phases

### Phase 1 — Per-branch balances and movement history

- Add `stockBalances` (branchId, itemCode, quantityOnHand, lastMovementAt, lastMovementBy).
- Add `stockMovements` (branchId, itemCode, quantityDelta, quantityAfter, movementType, referenceType, referenceId, userId, createdAt, notes).
- Implement `deductForDeliveryOrder`, `restoreForDeliveryOrderVoid`, `adjustStock` (with movement + balance update).
- DO create/void APIs: pass branchId; call new Convex mutations; decide whether to fail DO create on insufficient stock.
- Migrate existing `stockKeeping` data: one-time script to insert `stockBalances` for a default branch (or per branch if you already have location).
- UI: branch selector, balances table per branch, movement list, manual adjustment form.

### Phase 2 — Transfers and goods receipt

- Implement `createTransfer` and `recordGoodsReceipt`.
- UI: Transfer form (from/to branch, lines), Goods receipt form (branch, lines, reference).

### Phase 3 — Stock take and reorder

- Implement `recordStockTake`; optional approval for large variances.
- Add `stockReorderSettings`; implement `getReorderReport`; optional min-level check in DO creation.
- UI: Stock take entry and variance review; Reorder report and (if desired) reorder settings per branch/item.

### Phase 4 — Reservations and AutoCount (optional)

- If needed: add `stockReservations` and reserve on DO create, deduct on DO “post” or “deliver”, release on void.
- Define and implement AutoCount sync or reconciliation (read-only report, one-way sync, or two-way with clear master).

---

## 8. Summary

| Concept | Design choice |
|--------|----------------|
| **Scope** | Per-branch balances (branchId + itemCode). |
| **Audit** | Every change is a `stockMovements` row; balance is derived from movements. |
| **DO** | Create → deduct at branch; Void → restore at branch. Optionally validate stock before deduct. |
| **Manual** | Adjustments and stock take create movements with type and reference. |
| **Transfers** | OUT at source branch, IN at destination, same batch reference. |
| **Optional** | Reservations, reorder min/max, sync or reconciliation with AutoCount. |

This design gives a full-fledged stock keeping system: multi-location, traceable, and extendable with transfers, stock take, and reorder logic, while fitting your existing branches and delivery order flow.

---

## 9. Current implementation (shared stock)

**All branches share the same stock.** One quantity per item is stored in Convex table `stockKeeping`. No branch is used for stock.

- **DO create:** Deducts from global stock via `stockKeeping.adjustStock` (negative delta).
- **DO void:** Restores to global stock via `stockKeeping.adjustStock` (positive delta).
- **Stock Keeping page:** Single table — products merged with `stockKeeping`; search and edit quantity/notes (for users with settings permission).

The `stockBalances` and `stockMovements` tables and Convex module remain in the codebase for a future per-branch rollout if needed.
