# Design System & Wireframe Guidelines: Professional Accounting Software
**Theme:** Light Mode Only (High Precision & Low Eye Strain)
**Version:** 1.0

---

## 1. Core Philosophy
Accounting interfaces require long dwell times. The design must prioritize:
1.  **Data Legibility:** Numbers must be scannable.
2.  **Low Cognitive Load:** Cool tones to reduce eye strain.
3.  **Semantic Clarity:** Color is used *only* to convey meaning (Status, Profit, Loss), not for decoration.

---

## 2. Color Palette ("Enterprise Clean")

### A. Structure & Surface
These colors build the skeleton of the interface. We avoid pure white for the main background to reduce glare.

| Token | Hex Code | Usage |
| :--- | :--- | :--- |
| `bg-app` | **#F4F5F7** | Main application background (Canvas). |
| `bg-surface` | **#FFFFFF** | Cards, Table backgrounds, Sidebars. |
| `border-subtle` | **#DFE1E6** | Card borders, Dividers. |
| `border-focus` | **#4C9AFF** | Input field focus state. |

### B. Typography
We use deep blue-grays instead of pure black (`#000000`) to soften the contrast while maintaining readability.

| Token | Hex Code | Usage |
| :--- | :--- | :--- |
| `text-primary` | **#172B4D** | Headings, Main values, Active text. |
| `text-secondary` | **#6B778C** | Labels, Column Headers, Metadata. |
| `text-disabled` | **#A5ADBA** | Disabled buttons, Empty states. |

### C. Brand & Interaction
| Token | Hex Code | Usage |
| :--- | :--- | :--- |
| `brand-primary` | **#0052CC** | Primary Buttons, Links, Active Navigation. |
| `brand-hover` | **#0065FF** | Hover state for primary actions. |
| `ui-hover` | **#EBECF0** | Hover state for table rows and icon buttons. |

### D. Financial Semantics (The "Money" Colors)
*Strict rules apply here. Do not use these colors for decoration.*

| Token | Hex Code | Meaning |
| :--- | :--- | :--- |
| `finance-credit` | **#006644** | (Green) Revenue, Assets, "Paid" status. |
| `finance-debit` | **#DE350B** | (Red) Expenses, Liabilities, "Overdue" status. |
| `finance-warn` | **#FF991F** | (Orange) Pending, Draft, Approvals needed. |
| `finance-info` | **#403294** | (Purple) Audited, Reconciled (Neutral positive). |

---

## 3. Typography Guidelines

**Font Family:** `Inter`, `Roboto`, or System UI (`-apple-system`).
**Base Size:** 14px (Optimized for density).

### The "Tabular Figures" Rule (CRITICAL)
For any column displaying currency or quantities, you **must** use Monospaced or Tabular Lining figures. This ensures that the digit "1" takes up the same width as "8", allowing decimal points to align vertically.

**CSS Property:**
```css
font-feature-settings: "tnum" on, "lnum" on;
4. Component Guidelines
A. Data Tables (The Core Component)
Row Height: Compact (40px) or Standard (48px).

Zebra Striping:

Odd Rows: #FFFFFF

Even Rows: #FAFBFC (Very subtle separation).

Alignment Rules:

Left Align: Text (Client Name, Description, ID).

Right Align: Numbers (Amount, Qty, Tax). Never center align money.

Right Align: Headers for number columns.

Action Column: Stick to the far right. Use a "Kebab" icon (...) for secondary actions (Edit, Delete) to reduce clutter.

B. Input Fields
Background: #F4F5F7 (Light Gray) instead of a simple underline. This increases the "hit area" for users doing rapid data entry.

Label Position: Top-aligned labels are best for speed.

5. Wireframe Specs
Layout A: The "Dashboard" (High-Level View)
1. Left Sidebar (Navigation)

Width: 240px. Fixed position.

Background: #FFFFFF.

Content: Logo (Top), Menu Items (Dashboard, Sales, Purchases, Reporting), User Profile (Bottom).

2. Top Header

Height: 60px.

Background: #FFFFFF (Border-bottom #DFE1E6).

Content: "Global Search" bar (Center), Notifications Bell (Right), Quick Add Button (Right).

3. Main Canvas (#F4F5F7)

Zone A: Financial Health (Cards)

Row of 4 Cards: Cash on Hand, Accounts Receivable, Accounts Payable, Net Profit.

Design: White card, shadow-sm. Big Number (24px #172B4D). Small trend indicator (+12% in Green).

Zone B: Cash Flow Chart

Large Card (2/3 width).

Bar chart (Revenue vs Expenses).

Zone C: Action Items

Smaller Card (1/3 width).

List view: "5 Invoices Overdue", "2 Bank Feeds to Reconcile."

Layout B: The "Invoice List" (Data Dense)
1. Page Header

Title: "Invoices" (H2).

Controls: Filter Button, Export Icon, Primary Button ("+ New Invoice").

2. Filter Bar

A horizontal bar below the header.

Dropdowns: "Status (All)", "Date Range", "Client".

3. The Master Table

Header Row:

[Checkbox] | Status | Date | Number | Client | Due Date | Amount (Right Aligned) | [Actions]

Data Row Example:

[ ] | [Badge: Paid (Green)] | Oct 24 | INV-001 | Acme Corp | Oct 31 | $1,200.00 | [...]

Footer:

Pagination (Rows per page: 25, 50, 100).

6. Developer Handover (CSS Variables)
CSS

:root {
  /* BACKGROUNDS */
  --bg-app: #F4F5F7;
  --bg-surface: #FFFFFF;
  --bg-input: #F4F5F7;
  
  /* BORDERS */
  --border-subtle: #DFE1E6;
  --border-input: #DFE1E6;
  --border-focus: #4C9AFF;

  /* TEXT */
  --text-main: #172B4D;
  --text-muted: #6B778C;
  --text-on-brand: #FFFFFF;

  /* BRAND & ACTIONS */
  --primary: #0052CC;
  --primary-hover: #0065FF;
  
  /* SEMANTIC STATUS */
  --success-bg: #E3FCEF;
  --success-text: #006644;
  --danger-bg: #FFEBE6;
  --danger-text: #DE350B;
  --warning-bg: #FFFAE6;
  --warning-text: #BF2600; /* Darker orange for text readability */
}

/* UTILITY CLASS FOR NUMBERS */
.numeric-data {
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-family: 'Roboto Mono', monospace; /* Fallback */
}