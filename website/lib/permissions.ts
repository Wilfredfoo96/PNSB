/**
 * Roles and Permissions System
 * 
 * Roles:
 * - super_admin: Full access to everything
 * - admin: Access to everything except Debugging
 * - staff: Access to everything except System section (Users Management and Debugging)
 */

export type UserRole = 'super_admin' | 'admin' | 'staff'

export interface Permission {
  canAccessDashboard: boolean
  canAccessDeliveryOrders: boolean
  canAccessTemporaryReceipts: boolean
  canAccessCustomers: boolean
  canAccessProducts: boolean
  canAccessSettings: boolean
  canAccessUsersManagement: boolean
  canAccessDebugging: boolean
  canAccessReports: boolean
  canCreateBranch: boolean
  canDeleteBranch: boolean
}

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: UserRole | undefined | null): Permission {
  // Default to staff if no role is set
  const userRole = role || 'staff'

  switch (userRole) {
    case 'super_admin':
      return {
        canAccessDashboard: true,
        canAccessDeliveryOrders: true,
        canAccessTemporaryReceipts: true,
        canAccessCustomers: true,
        canAccessProducts: true,
        canAccessSettings: true,
        canAccessUsersManagement: true,
        canAccessDebugging: true,
        canAccessReports: true,
        canCreateBranch: true,
        canDeleteBranch: true,
      }
    
    case 'admin':
      return {
        canAccessDashboard: true,
        canAccessDeliveryOrders: true,
        canAccessTemporaryReceipts: true,
        canAccessCustomers: true,
        canAccessProducts: true,
        canAccessSettings: true,
        canAccessUsersManagement: true,
        canAccessDebugging: false, // Admin cannot access debugging
        canAccessReports: true,
        canCreateBranch: true,
        canDeleteBranch: true,
      }
    
    case 'staff':
      return {
        canAccessDashboard: true,
        canAccessDeliveryOrders: true,
        canAccessTemporaryReceipts: true,
        canAccessCustomers: true,
        canAccessProducts: true,
        canAccessSettings: false, // Staff cannot access settings
        canAccessUsersManagement: false, // Staff cannot access users management
        canAccessDebugging: false, // Staff cannot access debugging
        canAccessReports: true,
        canCreateBranch: false, // Staff cannot create branches
        canDeleteBranch: false, // Staff cannot delete branches
      }
    
    default:
      // Default to most restrictive (staff)
      return {
        canAccessDashboard: true,
        canAccessDeliveryOrders: true,
        canAccessTemporaryReceipts: true,
        canAccessCustomers: true,
        canAccessProducts: true,
        canAccessSettings: false,
        canAccessUsersManagement: false,
        canAccessDebugging: false,
        canAccessReports: true,
        canCreateBranch: false,
        canDeleteBranch: false,
      }
  }
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: UserRole | undefined | null, route: string): boolean {
  const permissions = getPermissionsForRole(role)
  
  if (route === '/dashboard') return permissions.canAccessDashboard
  if (route === '/dashboard/delivery-orders') return permissions.canAccessDeliveryOrders
  if (route === '/dashboard/temporary-receipts') return permissions.canAccessTemporaryReceipts
  if (route === '/dashboard/customers') return permissions.canAccessCustomers
  if (route === '/dashboard/products') return permissions.canAccessProducts
  if (route === '/dashboard/users') return permissions.canAccessUsersManagement
  if (route === '/dashboard/reports') return permissions.canAccessReports
  if (route.startsWith('/dashboard/debugging')) return permissions.canAccessDebugging
  
  // Default to true for unknown routes (let middleware handle it)
  return true
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole | undefined | null): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin'
    case 'admin':
      return 'Admin'
    case 'staff':
      return 'Staff'
    default:
      return 'Staff'
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole | undefined | null): string {
  switch (role) {
    case 'super_admin':
      return 'bg-purple-100 text-purple-800'
    case 'admin':
      return 'bg-blue-100 text-blue-800'
    case 'staff':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
