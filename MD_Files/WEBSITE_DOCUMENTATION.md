# Website Documentation - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Authentication & Authorization](#authentication--authorization)
6. [Dashboard Pages](#dashboard-pages)
7. [API Routes](#api-routes)
8. [Design System](#design-system)
9. [Data Flow](#data-flow)
10. [Features & Functionality](#features--functionality)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Overview

This is a **Next.js-based web application** that provides a cloud interface for managing AutoCount Accounting data. The website serves as the frontend layer, connecting users to an on-premise AutoCount Accounting system through a secure REST API hosted on IIS.

### Key Characteristics
- **Cloud-First**: Deployed on Vercel for global accessibility
- **Secure**: Uses Clerk for authentication and API key-based backend security
- **Real-Time**: Fetches live data from AutoCount Accounting system
- **Professional UI**: Designed specifically for accounting professionals with low eye strain
- **Posting-Safe**: All transactions go through AutoCount's business logic

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud (Vercel)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js Website (Frontend)                           │  │
│  │  - React Components                                   │  │
│  │  - Clerk Authentication                               │  │
│  │  - API Routes (Next.js API Routes)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          │ (Cloudflare Tunnel)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              On-Premise Server                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  IIS REST API (ASP.NET Core)                          │  │
│  │  - API Key Authentication                             │  │
│  │  - Business Logic Layer                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AutoCount Accounting Logic                            │  │
│  │  - Document Posting                                    │  │
│  │  - Validation Rules                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SQL Server Database                                  │  │
│  │  - AutoCount Database                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **User Action** → User interacts with Next.js frontend
2. **API Call** → Next.js API route calls IIS API via Cloudflare Tunnel
3. **Business Logic** → IIS API processes request through AutoCount logic
4. **Database** → AutoCount writes to SQL Server database
5. **Response** → Data flows back through the chain to the user

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React
- **Styling**: Tailwind CSS
- **Components**: Custom UI components (shadcn/ui style)
- **Authentication**: Clerk
- **State Management**: React Hooks (useState, useEffect)
- **HTTP Client**: Fetch API

### Backend Integration
- **API Client**: Custom TypeScript client (`autocount-api-client.ts`)
- **API Routes**: Next.js API Routes (serverless functions)
- **Tunnel**: Cloudflare Tunnel (for secure on-premise connection)

### Deployment
- **Hosting**: Vercel
- **Database**: SQL Server (on-premise, via IIS API)
- **Tunnel Service**: Cloudflare Tunnel (Windows Service)

---

## Project Structure

```
website/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Next.js API)
│   │   ├── autocount/            # AutoCount integration endpoints
│   │   │   ├── customers/       # Customer CRUD operations
│   │   │   ├── products-v2/     # Product listing
│   │   │   ├── delivery-orders-v2/ # Delivery order operations
│   │   │   └── invoices-v2/      # Invoice operations (hidden from UI)
│   │   ├── temporary-receipts/  # Temporary receipt management
│   │   └── webhooks/            # Clerk webhooks
│   ├── dashboard/                # Dashboard pages
│   │   ├── page.tsx             # Main dashboard (financial overview)
│   │   ├── customers/           # Customer management page
│   │   ├── products/            # Product management page
│   │   ├── delivery-orders/     # Delivery order management page
│   │   ├── users/               # User management page
│   │   ├── temporary-receipts/  # Temporary receipts page
│   │   └── debugging/           # Debug tools (database explorer)
│   ├── sign-in/                  # Sign in page
│   ├── sign-up/                  # Sign up page
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/                   # React components
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   ├── Overview.tsx         # Cash flow chart component
│   │   └── RecentActivity.tsx   # Action items component
│   └── ui/                      # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── lib/                          # Utility libraries
│   ├── autocount-api-client.ts   # IIS API client library
│   ├── autocount-api-client-instance.ts # Singleton instance
│   └── utils.ts                 # Utility functions
├── middleware.ts                 # Next.js middleware (auth)
├── package.json                  # Dependencies
└── next.config.js               # Next.js configuration
```

---

## Authentication & Authorization

### User Authentication (Clerk)
- **Provider**: Clerk (SaaS authentication service)
- **Flow**: 
  1. User signs up/signs in via Clerk
  2. Clerk manages sessions and user data
  3. Next.js middleware protects routes
  4. User data available via `@clerk/nextjs` hooks

### API Authentication (IIS API)
- **Method**: API Key authentication
- **Header**: `X-API-Key: <api-key>`
- **Location**: Environment variables
- **Protection**: All API calls to IIS require valid API key

### Route Protection
- **Public Routes**: `/`, `/sign-in`, `/sign-up`
- **Protected Routes**: All `/dashboard/*` routes require authentication
- **Middleware**: `middleware.ts` checks authentication status

---

## Dashboard Pages

### 1. Dashboard Home (`/dashboard`)
**Purpose**: Financial overview and key metrics

**Features**:
- **Financial Health Cards**:
  - Cash on Hand: Sum of paid invoice amounts
  - Accounts Receivable: Outstanding invoice amounts
  - Accounts Payable: Outstanding bills (placeholder)
  - Net Profit: Calculated profit/loss
- **Cash Flow Chart**: Monthly revenue vs expenses (last 6 months)
- **Action Items**: 
  - Overdue invoices count
  - Pending delivery orders count
  - Clickable links to filtered views

**Data Sources**:
- Fetches all invoices (paginated)
- Fetches all delivery orders (paginated)
- Calculates metrics in real-time

### 2. Customers (`/dashboard/customers`)
**Purpose**: Manage customer/debtor records

**Features**:
- List all customers with pagination
- Search customers by name, account number, etc.
- Create new customer
- Edit customer details
- View customer details
- Delete customer (soft delete - sets inactive)
- Auto-generate account numbers

**Data Flow**:
- Frontend → `/api/autocount/customers` → IIS API → AutoCount → Database

### 3. Products (`/dashboard/products`)
**Purpose**: Manage product/item inventory

**Features**:
- List all products with pagination
- Search products by code, description, etc.
- Filter by category, brand, type
- Create new product
- Edit product details
- View product details
- Auto-generate item codes
- Display product pricing and UOM information

**Data Flow**:
- Frontend → `/api/autocount/products-v2` → IIS API → AutoCount → Database

### 4. Delivery Orders (`/dashboard/delivery-orders`)
**Purpose**: Manage delivery orders (sales orders)

**Features**:
- List all delivery orders with pagination
- Search by document number, customer, etc.
- Filter by status (Draft, Posted, Void)
- Create new delivery order
- Edit draft delivery orders
- View delivery order details
- Post delivery order (finalize)
- Void delivery order
- Add line items via product selection modal
- Auto-populate product details (UOM, Tax Code, Price)
- Default quantity: 1

**Data Flow**:
- Frontend → `/api/autocount/delivery-orders-v2` → IIS API → AutoCount → Database

**Document Lifecycle**:
1. **Draft**: Created, can be edited
2. **Posted**: Finalized, cannot be edited
3. **Void**: Cancelled, cannot be edited

### 5. Users (`/dashboard/users`)
**Purpose**: Manage application users (Clerk users)

**Features**:
- List all users
- Search users
- Add new user
- Edit user details
- View user information

**Data Source**: Clerk API (via Convex backend)

### 6. Temporary Receipts (`/dashboard/temporary-receipts`)
**Purpose**: Manage temporary receipt records

**Features**:
- List temporary receipts
- Create new temporary receipt
- View receipt details

**Data Source**: Convex database

### 7. Debugging Tools (`/dashboard/debugging`)
**Purpose**: Development and troubleshooting tools

**Pages**:
- **Database Explorer**: Browse AutoCount database tables
- **Database Schema**: View database schema information

**Access**: Development/debugging only

---

## API Routes

### Next.js API Routes (Server-Side)

All API routes are located in `app/api/` and act as a proxy layer between the frontend and IIS API.

#### AutoCount Integration Routes

**Base Path**: `/api/autocount/`

##### Customers
- `GET /api/autocount/customers` - List customers (paginated, searchable)
- `GET /api/autocount/customers/[accNo]` - Get customer by account number
- `POST /api/autocount/customers` - Create new customer
- `PUT /api/autocount/customers/[accNo]` - Update customer
- `DELETE /api/autocount/customers/[accNo]` - Delete customer (soft delete)

##### Products
- `GET /api/autocount/products-v2` - List products (paginated, searchable, filterable)
- `GET /api/autocount/products/[itemCode]` - Get product by item code

##### Delivery Orders
- `GET /api/autocount/delivery-orders-v2` - List delivery orders (paginated, searchable)
- `GET /api/autocount/delivery-orders-v2/[docKey]` - Get delivery order by DocKey
- `POST /api/autocount/delivery-orders-v2` - Create new delivery order
- `PUT /api/autocount/delivery-orders-v2/[docKey]` - Update delivery order (draft only)
- `POST /api/autocount/delivery-orders-v2/[docKey]/post` - Post delivery order

##### Invoices (Hidden from UI)
- `GET /api/autocount/invoices-v2` - List invoices (used by dashboard)
- `GET /api/autocount/invoices-v2/[docKey]` - Get invoice by DocKey
- `POST /api/autocount/invoices-v2` - Create new invoice
- `PUT /api/autocount/invoices-v2/[docKey]` - Update invoice (draft only)
- `POST /api/autocount/invoices-v2/[docKey]/post` - Post invoice

**Note**: Invoice routes exist but are not accessible via UI (removed from sidebar navigation).

#### Other Routes
- `GET /api/temporary-receipts` - List temporary receipts
- `POST /api/temporary-receipts` - Create temporary receipt
- `POST /api/webhooks/clerk` - Clerk webhook handler

### API Client Library

**Location**: `lib/autocount-api-client.ts`

A TypeScript client that provides type-safe methods to interact with the IIS API:

```typescript
// Example usage
const apiClient = getAutoCountApiClient()
const response = await apiClient.getDebtors({ page: 1, pageSize: 50 })
```

**Key Methods**:
- `getDebtors()` - Get customers
- `getItems()` - Get products
- `getInvoices()` - Get invoices
- `getDeliveryOrders()` - Get delivery orders
- `createDebtor()` - Create customer
- `createItem()` - Create product
- `createInvoice()` - Create invoice
- `createDeliveryOrder()` - Create delivery order
- And more...

---

## Design System

### Color Palette

Based on `design.md` specifications:

**Structure & Surface**:
- `bg-app`: `#F4F5F7` - Main application background
- `bg-surface`: `#FFFFFF` - Cards, table backgrounds
- `border-subtle`: `#DFE1E6` - Card borders, dividers
- `border-focus`: `#4C9AFF` - Input field focus state

**Typography**:
- `text-primary`: `#172B4D` - Headings, main values
- `text-secondary`: `#6B778C` - Labels, metadata
- `text-disabled`: `#A5ADBA` - Disabled elements

**Brand & Interaction**:
- `brand-primary`: `#0052CC` - Primary buttons, links
- `brand-hover`: `#0065FF` - Hover state
- `ui-hover`: `#EBECF0` - Table row hover

**Financial Semantics**:
- `finance-credit`: `#006644` - Revenue, assets, "Paid" status (Green)
- `finance-debit`: `#DE350B` - Expenses, liabilities, "Overdue" status (Red)
- `finance-warn`: `#FF991F` - Pending, draft, approvals needed (Orange)
- `finance-info`: `#403294` - Audited, reconciled (Purple)

### Typography
- **Font Family**: Inter, Roboto, or System UI
- **Base Size**: 14px
- **Tabular Figures**: Used for all currency and quantity columns
  ```css
  font-feature-settings: "tnum" on, "lnum" on;
  ```

### Component Guidelines

**Data Tables**:
- Row Height: 40px (compact) or 48px (standard)
- Zebra Striping: Odd rows `#FFFFFF`, Even rows `#FAFBFC`
- Alignment: Text left-aligned, Numbers right-aligned
- Action Column: Far right, uses kebab menu (⋯)

**Input Fields**:
- Background: `#F4F5F7` (light gray)
- Label Position: Top-aligned
- Focus State: Blue border (`#4C9AFF`)

---

## Data Flow

### Example: Creating a Delivery Order

1. **User Action**: User clicks "Create Delivery Order" button
2. **Frontend**: Opens modal, user fills in form
3. **Product Selection**: User selects products from modal (fetches from `/api/autocount/products-v2`)
4. **Form Submission**: Frontend calls `POST /api/autocount/delivery-orders-v2`
5. **Next.js API Route**: 
   - Validates authentication (Clerk)
   - Calls IIS API client: `apiClient.createDeliveryOrder(data)`
   - Returns response to frontend
6. **IIS API**: 
   - Validates API key
   - Processes through AutoCount business logic
   - Creates document in database
   - Returns created document
7. **Frontend**: Updates UI, shows success message

### Example: Dashboard Data Loading

1. **Page Load**: Dashboard component mounts
2. **useEffect Hook**: Triggers data fetching
3. **Parallel Requests**:
   - Fetch invoices: `GET /api/autocount/invoices-v2?page=1&limit=100`
   - Fetch delivery orders: `GET /api/autocount/delivery-orders-v2?page=1&limit=100`
4. **Pagination**: Continues fetching until all data retrieved (max 1000 records)
5. **Calculation**: Calculates financial metrics from invoice data
6. **Rendering**: Updates UI with real-time data

---

## Features & Functionality

### Auto-Generation
- **Customer Account Numbers**: Auto-generated when creating new customer
- **Product Item Codes**: Auto-generated when creating new product
- **Document Numbers**: Auto-generated for invoices and delivery orders

### Product Selection Modal
- **Location**: Used in Delivery Orders and Invoices pages
- **Features**:
  - Search products by code or description
  - Real-time search results
  - Click to select product
  - Auto-populates: Item Code, Description, UOM, Tax Code, Price
  - Default quantity: 1

### Pagination
- **Standard**: 50 items per page
- **Configurable**: Can be adjusted per page
- **Search**: Works with pagination
- **Status Filters**: Available for delivery orders and invoices

### Real-Time Updates
- **Dashboard**: Fetches fresh data on page load
- **Lists**: Refresh after create/update/delete operations
- **Calculations**: Performed client-side from fetched data

### Error Handling
- **API Errors**: Displayed to user via toast notifications
- **Validation**: Client-side and server-side validation
- **Loading States**: Loading indicators during API calls

---

## Deployment

### Vercel Deployment

1. **Connect Repository**: Link GitHub/GitLab repository to Vercel
2. **Environment Variables**: Set in Vercel dashboard:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `AUTOCOUNT_API_BASE_URL` (Cloudflare Tunnel URL)
   - `AUTOCOUNT_API_KEY`
   - `CONVEX_DEPLOYMENT`
   - Other required variables
3. **Build Settings**: 
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. **Deploy**: Automatic on git push

### Cloudflare Tunnel

**Purpose**: Securely expose on-premise IIS API to the internet

**Setup**:
- Installed as Windows Service
- Managed via `tunnel-service.ps1` script
- Tunnel ID: `2932d861-78f4-4be5-9d7e-9d1e6ce53f72`
- Public URL: `https://api.pnsbmy.com`

**Management**:
```powershell
# Check status
.\autocount-api\Installer\tunnel-service.ps1 status

# Start tunnel
.\autocount-api\Installer\tunnel-service.ps1 start

# Restart tunnel
.\autocount-api\Installer\tunnel-service.ps1 restart
```

---

## Troubleshooting

### Common Issues

#### 1. API Connection Errors
**Symptoms**: "Failed to fetch" or "Network error"

**Solutions**:
- Check Cloudflare Tunnel status
- Verify `AUTOCOUNT_API_BASE_URL` environment variable
- Check IIS API is running
- Verify API key is correct

#### 2. Authentication Issues
**Symptoms**: "Unauthorized" errors

**Solutions**:
- Check Clerk configuration
- Verify environment variables are set
- Clear browser cache and cookies
- Check user is signed in

#### 3. Data Not Loading
**Symptoms**: Empty lists or "No data" messages

**Solutions**:
- Check browser console for errors
- Verify API endpoints are accessible
- Check IIS API logs
- Verify database connection

#### 4. Styling Issues
**Symptoms**: Components not styled correctly

**Solutions**:
- Verify Tailwind CSS is configured
- Check `globals.css` is imported
- Clear Next.js cache: `.next` folder

### Debug Tools

1. **Browser DevTools**: Check Network tab for API calls
2. **Console Logs**: Check for JavaScript errors
3. **Database Explorer**: `/dashboard/debugging/database-explorer`
4. **API Logs**: Check IIS API logs on server
5. **Vercel Logs**: Check deployment logs in Vercel dashboard

---

## Key Files Reference

### Configuration Files
- `next.config.js` - Next.js configuration
- `package.json` - Dependencies and scripts
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `middleware.ts` - Authentication middleware

### Core Components
- `app/dashboard/layout.tsx` - Dashboard layout wrapper
- `components/dashboard/Sidebar.tsx` - Navigation sidebar
- `components/dashboard/Overview.tsx` - Cash flow chart
- `components/dashboard/RecentActivity.tsx` - Action items

### API Client
- `lib/autocount-api-client.ts` - IIS API client library
- `lib/autocount-api-client-instance.ts` - Singleton instance helper

### Design System
- `design.md` - Complete design system specifications
- `app/globals.css` - Global styles and CSS variables

---

## Future Enhancements

### Planned Features
- [ ] Supplier/Purchase invoice management
- [ ] Payment processing
- [ ] Advanced reporting
- [ ] Export functionality (PDF, Excel)
- [ ] Email notifications
- [ ] Mobile responsive improvements
- [ ] Real-time notifications
- [ ] Advanced search and filtering

### Technical Improvements
- [ ] Add caching layer for frequently accessed data
- [ ] Implement optimistic UI updates
- [ ] Add offline support
- [ ] Improve error messages
- [ ] Add data validation feedback
- [ ] Performance optimizations

---

## Support & Resources

### Documentation
- **Project README**: `README.md` - Complete project setup guide
- **Design System**: `design.md` - UI/UX specifications
- **This Document**: `WEBSITE_DOCUMENTATION.md` - Website-specific guide

### External Resources
- **Next.js Docs**: https://nextjs.org/docs
- **Clerk Docs**: https://clerk.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Vercel Docs**: https://vercel.com/docs

---

**Last Updated**: 2024
**Version**: 1.0
