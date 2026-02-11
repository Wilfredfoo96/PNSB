# Stock Keeping — Making It More Intuitive

This document suggests UX improvements so stock keeping feels obvious to use: the right information first, clear language, and workflows that match how people think about stock.

---

## 1. What Users Actually Need

- **“What do I have?”** — Current quantity per item, at a glance.
- **“Why did it change?”** — History of ins, outs, and who did what.
- **“I need to fix it.”** — Adjust quantity or add a note without hunting.

Today we have all three, but the **balance** (what I have) and the **story** (why it changed) compete on one table, and the story is hidden behind “View logs”. Below is a more intuitive structure.

---

## 2. One Clear Home: Balances First, History One Click Away

**Idea:** Make the main view **only** about current stock. Move “why it changed” to a dedicated place that’s still easy to reach.

- **Default view:** One table/screen = **Stock levels** (item, description, quantity, last movement date, optional notes). No “Logs” column here — just a single primary action: **View history** (or a row click) for that item.
- **History:** Either:
  - **Option A:** Same page, second “mode” or tab: **“Movement history”** with an item filter (search/select item) and a single list of in/out lines (date, type, in, out, balance after, reference, user, notes). So “logs” are a first-class view, not buried in a modal.
  - **Option B:** Keep per-item logs in a side panel or modal, but **label the button by outcome**: e.g. **“History”** or **“In/out history”** instead of “View logs”, and open a **drawer** from the right (so the list stays visible on the left) instead of a centered modal.

**Why it’s more intuitive:** The main screen answers “What do I have?”. “Why did it change?” is a separate, named concept (history / in–out) and is one click away, without cluttering the balance table.

---

## 3. Language That Matches How People Think

- **Avoid:** “View logs”, “Movement type”, “Quantity delta”, “Reference type/id”.
- **Prefer:**
  - **“Stock history”** or **“In / Out history”** (not “logs”).
  - **“In” / “Out”** as the main idea; type as a short label: **“Delivery”**, **“Void (return)”**, **“Adjustment”**.
  - **“Balance after”** → **“Stock after”** or keep “Balance after” if your users already say “balance”.
  - **“Reference”** → **“From”** or **“Document”**: e.g. “Delivery order #12345” instead of “DELIVERY_ORDER 12345”.
  - **“Date & time”** → **“When”** in compact UIs, or keep “Date & time” in tables.

Use **sentence-style** in empty states and tooltips: e.g. “No stock history for this item yet” instead of “No logs for this item yet.”

---

## 4. Progressive Disclosure: Don’t Show Everything at Once

- **Table row:** Show only: Item code, Description, **Quantity** (emphasised), **Last updated** (or “Last movement”). Notes can be “…” with tooltip or a small note icon that expands.
- **History view:** Default columns: **When**, **Type** (Delivery / Void / Adjustment), **In**, **Out**, **Stock after**, **Document** (e.g. DO #12345), **Notes**. **User** can be secondary (e.g. show on hover or in a “Details” expand).
- **Adjustment:** Don’t put “Adjust stock” in the table row by default. Have one clear **“Adjust stock”** button (or FAB) that opens a small form: select item (search/autocomplete), **New quantity** or **Change by (+/-)**, **Reason/notes**. After submit, show a short success: “Stock updated for [Item]. New quantity: X.”

This keeps the main screen scannable and makes “change quantity” a deliberate, guided action.

---

## 5. Make “Last Change” Obvious

- In the balance table, **“Last updated”** could be **“Last movement”** and show:
  - **When** (e.g. “2 hours ago” or date+time).
  - **What** (e.g. “Delivery −5” or “Adjustment +10”) in one short phrase.
- Optional: a small **indicator** (e.g. green dot for “in”, red for “out”) next to the last movement so users can see trend at a glance without opening history.

---

## 6. History: Filters and Date Range

- **By item:** Search or select item (required if the list is global).
- **By type:** Quick filters: **All** | **Delivery (out)** | **Return (void)** | **Adjustment**.
- **By date:** “Last 7 days”, “Last 30 days”, “Custom range”. Default “Last 30 days” avoids overwhelming new users.
- **Export:** “Export to CSV” for the current filters so users can audit or report without copying from the screen.

---

## 7. Empty and Loading States

- **No products:** “No products to show. Add products in Products first, or check filters.”
- **No history for item:** “No stock history for this item yet. History appears when stock is delivered, returned, or adjusted.”
- **Loading:** Skeleton rows (same columns as the table) instead of a single “Loading…” line so layout doesn’t jump.

---

## 8. Adjust Stock: Guided Flow

- **Entry point:** One **“Adjust stock”** (or “Correct quantity”) on the Stock Keeping page.
- **Step 1:** Choose item (type-ahead search by code or description).
- **Step 2:** Show **current quantity**; then either:
  - **Set new quantity** (e.g. after stock take), or
  - **Change by:** +/− with a number (e.g. “+10” or “−3”).
- **Step 3:** **Reason / notes** (optional but encouraged): short dropdown + free text, e.g. “Stock take” / “Damage” / “Received” / “Other”.
- **Step 4:** Confirm: “Update [Item] from 50 to 45 (−5). Reason: Stock take.” Then submit.
- **After submit:** Toast or inline message: “Stock updated. [Item]: 45.” and optionally “View history” link.

This makes adjustments explicit and traceable and avoids raw “quantity” boxes in the table that can be misused.

---

## 9. Small Wins

- **Quantity alignment:** Right-align quantity and “In/Out” columns so numbers line up.
- **Negative stock:** Red and/or “(negative)” so it’s unmissable.
- **Row density:** Optional “Compact” view (smaller font, less padding) for power users with many items.
- **Keyboard:** Enter on search focuses first result; Enter on “Adjust stock” submits when form is valid.
- **Mobile:** On small screens, consider a **card per item** (quantity big, “History” and “Adjust” as buttons) instead of a wide table.

---

## 10. Summary: Before vs After (Conceptual)

| Today | More intuitive |
|-------|----------------|
| Table has Quantity, Notes, Logs, Actions | Table = Stock levels only; History = separate view or drawer |
| “View logs” | “History” or “In/out history” |
| Technical labels (Movement type, Reference) | Human labels (Delivery, Void, Adjustment; Document #) |
| Edit quantity inline in table | “Adjust stock” flow: pick item → set/change qty → reason |
| One modal with all log columns | History with type + date filters; optional “Details” for user/reference |
| “Last updated” (timestamp only) | “Last movement” (when + what, e.g. “2h ago, Delivery −5”) |

The goal is: **at a glance you see what you have; in one click you see why it changed; and correcting stock is a clear, guided step** — so the system feels intuitive without reading docs.
