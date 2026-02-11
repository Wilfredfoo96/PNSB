# How to Manually Change User Roles in Convex

There are several ways to manually change a user's role in Convex. Choose the method that works best for you.

## Method 1: Using `updateUserRole` Function (Recommended - Most Reliable)

This is the **easiest and most reliable** method. The `updateUserRole` function was created specifically for this purpose and avoids validation issues.

1. **Open Convex Dashboard**
   - Go to: https://dashboard.convex.dev
   - Sign in with your Convex account
   - Select your project

2. **Go to Functions**
   - Click on **"Functions"** in the left sidebar
   - Find `updateUserRole` mutation

3. **Run the Mutation**
   - Click on `updateUserRole`
   - Click **"Run"** or **"Test"**
   - Enter the following JSON (replace with your actual values):
   ```json
   {
     "clerkId": "user_xxxxx",
     "role": "super_admin"
   }
   ```
   - Click **"Run"**
   - You should see: `{ "success": true, "role": "super_admin" }`

**How to find the Clerk ID:**
- In the Convex Dashboard, go to **Data** → `users` table
- Find your user and look at the `clerkId` field
- Copy that value and use it in the mutation

**Valid role values:**
- `super_admin` (full access)
- `admin` (no debugging access)
- `staff` (no system access)

## Method 2: Direct Edit in Convex Dashboard (Alternative)

**⚠️ Note:** Direct editing in the Data view may show validation errors. If you encounter issues, use Method 1 instead.

1. **Open Convex Dashboard**
   - Go to: https://dashboard.convex.dev
   - Sign in with your Convex account
   - Select your project

2. **Navigate to Data**
   - Click on **"Data"** in the left sidebar
   - Find the **`users`** table
   - Click on it to view all users

3. **Edit User Role**
   - Find the user you want to update
   - Click on the user row to open the editor
   - Find the `role` field
   - Change it to one of (enter as plain text, no quotes):
     - `super_admin`
     - `admin`
     - `staff`
   - Click **"Save"**

**If you get a validation error:** Use Method 1 (the `updateUserRole` function) instead.

## Method 3: Using the `users.upsertUser` Function (Full Update)

If you need to update multiple fields at once:

1. **Open Convex Dashboard**
   - Go to: https://dashboard.convex.dev
   - Select your project

2. **Go to Functions**
   - Click on **"Functions"** in the left sidebar
   - Find `users.upsertUser` mutation

3. **Run the Mutation**
   - Click on `users.upsertUser`
   - Click **"Run"** or **"Test"**
   - Enter the following JSON:
   ```json
   {
     "clerkId": "user_xxxxx",
     "email": "user@example.com",
     "role": "super_admin"
   }
   ```
   - Click **"Run"**

## Method 4: Using Convex CLI (Command Line)

1. **Navigate to your project**
   ```bash
   cd website
   ```

2. **Run the mutation via CLI**
   ```bash
   npx convex run updateUserRole '{
     "clerkId": "user_xxxxx",
     "role": "super_admin"
   }'
   ```

   Or using the full upsert:
   ```bash
   npx convex run users:upsertUser '{
     "clerkId": "user_xxxxx",
     "email": "user@example.com",
     "role": "super_admin"
   }'
   ```

## Method 5: Using the Website UI (Easiest for Regular Use)

The easiest way for regular use is through the website interface:

1. **Sign in** to your website as a Super Admin or Admin
2. **Navigate** to `/dashboard/users`
3. **Click "Edit"** on the user you want to change
4. **Select the new role** from the dropdown
5. **Click "Update User"**

**Note:** This method requires you to already have a user with `super_admin` or `admin` role. If you're locked out, use Method 1 to change your own role first.

## Finding User Clerk ID

To find a user's Clerk ID:

1. **Via Convex Dashboard:**
   - Go to **Data** → `users` table
   - Look at the `clerkId` field

2. **Via Website UI:**
   - Go to `/dashboard/users`
   - The Clerk ID is shown in the user details (ID: user_xxxxx)

3. **Via Clerk Dashboard:**
   - Go to: https://dashboard.clerk.com
   - Navigate to Users
   - The user ID is shown at the top of each user's profile

## Quick Reference: Role Values

- `super_admin` - Full access to everything
- `admin` - Access to everything except Debugging
- `staff` - Access to everything except System section

## Important Notes

- **Role values must be strings**: `"super_admin"`, `"admin"`, or `"staff"`
- **In Convex Dashboard Functions**: Use JSON format with quotes: `"super_admin"`
- **In Convex Dashboard Data View**: Enter as plain text (no quotes): `super_admin`
- **First user should be Super Admin** - Make sure at least one user has `super_admin` role to manage others
- **Changes take effect immediately** - No need to restart the application
- **Users without a role** default to `staff` permissions

## Troubleshooting

**If you get "super_admin is not a valid Convex value" error:**
- This usually happens when trying to edit directly in the Data view
- **Solution:** Use Method 1 (`updateUserRole` function) instead - it's more reliable
- Make sure the schema is deployed: `cd website && npx convex deploy`

**If you can't access Users Management:**
- You need to be logged in as a user with `super_admin` or `admin` role
- If you're locked out, use Method 1 to change your own role first

**If role changes aren't working:**
- Make sure you're using the exact string values: `"super_admin"`, `"admin"`, or `"staff"`
- Check that the `clerkId` matches exactly
- Refresh the page after making changes
- Try using Method 1 (`updateUserRole` function) for more reliable updates
