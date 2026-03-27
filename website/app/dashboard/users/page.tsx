'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Id } from '@/convex/_generated/dataModel'
import EditUserModal from '@/components/dashboard/EditUserModal'
import AddUserModal from '@/components/dashboard/AddUserModal'
import UserSearch from '@/components/dashboard/UserSearch'
import { useUserRole } from '@/hooks/useUserRole'
import { getPermissionsForRole, getRoleDisplayName, getRoleBadgeColor } from '@/lib/permissions'
import { useRouter } from 'next/navigation'

interface ConvexUser {
  _id: Id<'users'>
  _creationTime: number
  clerkId: string
  firstName?: string
  lastName?: string
  email: string
  imageUrl?: string
  bio?: string
  role?: 'super_admin' | 'admin' | 'staff'
  branchIds?: Id<'branches'>[]
  createdAt: number
  updatedAt: number
  lastSignInAt?: number
}

type SortField = 'firstName' | 'lastName' | 'email' | 'createdAt' | 'lastSignInAt'
type SortOrder = 'asc' | 'desc'

export default function UsersPage() {
  const { user } = useUser()
  const userRole = useUserRole()
  const router = useRouter()
  const permissions = getPermissionsForRole(userRole)
  const [selectedUser, setSelectedUser] = useState<ConvexUser | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  const toast = useToast()

  // Check permissions
  useEffect(() => {
    if (userRole !== null && !permissions.canAccessUsersManagement) {
      router.push('/dashboard')
    }
  }, [userRole, permissions.canAccessUsersManagement, router])

  // Fetch users from Convex
  const usersResult = useQuery(api.users.getUsers, { limit: 1000 })
  const branches = useQuery(api.branches.getBranches) || []
  const deleteUserMutation = useMutation(api.users.deleteUser)
  const upsertUserMutation = useMutation(api.users.upsertUser)

  // Sync current user to Convex when component mounts
  useEffect(() => {
    if (user && usersResult?.page) {
      // Check if current user exists in the users list
      const currentUserExists = usersResult.page.some(
        (convexUser) => convexUser.clerkId === user.id
      )
      
      if (!currentUserExists) {
        // User doesn't exist in Convex, create them
        const syncCurrentUser = async () => {
          try {
            await upsertUserMutation({
              clerkId: user.id,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
              email: user.emailAddresses[0]?.emailAddress || '',
              imageUrl: user.imageUrl || undefined,
            })
            toast.success('Your profile has been synced to the system')
          } catch (error) {
            console.error('Failed to sync user:', error)
          }
        }
        
        syncCurrentUser()
      }
    }
  }, [user, usersResult?.page, upsertUserMutation, toast])

  // Get all users from paginated result
  const allUsers = usersResult?.page || []

  // Process and filter users
  const processedUsers = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return []
    
    let filtered = [...allUsers]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user => 
        (user.firstName?.toLowerCase().includes(query)) ||
        (user.lastName?.toLowerCase().includes(query)) ||
        user.email.toLowerCase().includes(query) ||
        user.clerkId.toLowerCase().includes(query) ||
        (user.bio?.toLowerCase().includes(query))
      )
    }

    // Apply category filter
    switch (activeFilter) {
      case 'active':
        filtered = filtered.filter(user => user.lastSignInAt && 
          (Date.now() - user.lastSignInAt) < 30 * 24 * 60 * 60 * 1000) // Last 30 days
        break
      case 'recent':
        filtered = filtered.filter(user => 
          (Date.now() - user.createdAt) < 7 * 24 * 60 * 60 * 1000) // Last 7 days
        break
      case 'with-bio':
        filtered = filtered.filter(user => user.bio && user.bio.trim().length > 0)
        break
      case 'no-bio':
        filtered = filtered.filter(user => !user.bio || user.bio.trim().length === 0)
        break
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]
      
      if (sortField === 'firstName' || sortField === 'lastName') {
        aValue = (aValue || '').toLowerCase()
        bValue = (bValue || '').toLowerCase()
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [allUsers, searchQuery, activeFilter, sortField, sortOrder])

  // Pagination
  const totalPages = Math.ceil(processedUsers.length / itemsPerPage)
  const paginatedUsers = processedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleDeleteUser = async (userId: Id<'users'>) => {
    try {
      await deleteUserMutation({ id: userId })
      toast.success('User deleted successfully')
      setIsDeleteModalOpen(false)
      setSelectedUser(null)
    } catch (err) {
      toast.error('Failed to delete user')
    }
  }

  const handleEditUser = (user: ConvexUser | any) => {
    setSelectedUser(user)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (user: ConvexUser | any) => {
    setSelectedUser(user)
    setIsDeleteModalOpen(true)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page on search
  }

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
    setCurrentPage(1) // Reset to first page on filter change
  }

  const handleClear = () => {
    setSearchQuery('')
    setActiveFilter('all')
    setCurrentPage(1)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Loading state
  if (usersResult === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-2">Manage your application users</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => {
              if (user) {
                upsertUserMutation({
                  clerkId: user.id,
                  firstName: user.firstName || undefined,
                  lastName: user.lastName || undefined,
                  email: user.emailAddresses[0]?.emailAddress || '',
                  imageUrl: user.imageUrl || undefined,
                }).then(() => {
                  toast.success('Profile synced successfully!')
                }).catch((error) => {
                  toast.error('Failed to sync profile')
                  console.error('Sync error:', error)
                })
              }
            }}
            className="flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync My Profile
          </Button>
          {permissions.canAccessUsersManagement && (
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch('/api/users/sync', {
                    method: 'POST',
                  })
                  const data = await response.json()
                  if (response.ok) {
                    toast.success(`Synced ${data.synced} users from Clerk`)
                    // Refresh the page to show updated users
                    setTimeout(() => window.location.reload(), 1000)
                  } else {
                    toast.error(data.error || 'Failed to sync users')
                  }
                } catch (error) {
                  toast.error('Failed to sync users')
                  console.error('Sync error:', error)
                }
              }}
              className="flex items-center justify-center"
              title="Sync all users from Clerk"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync All Users
            </Button>
          )}
          <Button 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
            onClick={() => setIsAddModalOpen(true)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add User
          </Button>
        </div>
      </div>



      {/* Search and Filter */}
      <div className="w-full">
        <UserSearch 
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onClear={handleClear}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600">{processedUsers.length}</div>
                <div className="text-sm text-gray-600 mt-1">Total Users</div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {processedUsers.filter(u => u.lastSignInAt && (Date.now() - u.lastSignInAt) < 30 * 24 * 60 * 60 * 1000).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Active (30 days)</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-600">
                  {processedUsers.filter(u => u.bio && u.bio.trim().length > 0).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">With Bio</div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-600">
                  {processedUsers.filter(u => (Date.now() - u.createdAt) < 7 * 24 * 60 * 60 * 1000).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">New (7 days)</div>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-xl">User Management</CardTitle>
          <CardDescription>
            View and manage all users in your application. Currently showing {paginatedUsers.length} of {processedUsers.length} users.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('firstName')}>
                    <div className="flex items-center space-x-2">
                      <span>User</span>
                      {sortField === 'firstName' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('email')}>
                    <div className="flex items-center space-x-2">
                      <span>Email</span>
                      {sortField === 'email' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center space-x-2">
                      <span>Created</span>
                      {sortField === 'createdAt' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('lastSignInAt')}>
                    <div className="flex items-center space-x-2">
                      <span>Last Sign In</span>
                      {sortField === 'lastSignInAt' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Assign
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user, index) => (
                  <tr key={user._id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {user.imageUrl ? (
                            <img
                              src={user.imageUrl}
                              alt={`${user.firstName || ''} ${user.lastName || ''}`}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <span className={`${user.imageUrl ? 'hidden' : ''}`}>
                            {(user.firstName?.[0] || user.lastName?.[0] || user.email[0]).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">ID: {user.clerkId}</div>
                          {user.bio && (
                            <div className="text-xs text-gray-400 truncate max-w-32">
                              {user.bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.lastSignInAt 
                        ? new Date(user.lastSignInAt).toLocaleDateString('en-GB')
                        : <span className="text-gray-400 italic">Never</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(user.role as 'super_admin' | 'admin' | 'staff' | undefined)}`}>
                        {getRoleDisplayName(user.role as 'super_admin' | 'admin' | 'staff' | undefined)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.branchIds && user.branchIds.length > 0
                        ? user.branchIds
                            .map((id) => branches.find((b) => b._id === id)?.branchName || 'Unknown')
                            .join(', ')
                        : <span className="text-gray-400 italic">Not Assigned</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditUser(user as ConvexUser)}
                          className="hover:bg-blue-50 hover:border-blue-200"
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:bg-red-50 hover:border-red-200"
                          onClick={() => handleDeleteClick(user)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-100 px-6 py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, processedUsers.length)}</span> of{' '}
                  <span className="font-medium">{processedUsers.length}</span> results
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        className="w-10 h-10 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3"
                  >
                    Next
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          // Refresh data if needed
        }}
      />

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // Refresh data if needed
        }}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteUser(selectedUser._id)}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast.toasts.map((toastItem) => (
        <div key={toastItem.id} className="fixed top-4 right-4 z-50">
          <div className={`
            rounded-lg px-4 py-3 text-white shadow-lg flex items-center space-x-2
            ${toastItem.type === 'success' ? 'bg-green-500' : 
              toastItem.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
          `}>
            <span className="text-lg">
              {toastItem.type === 'success' ? '✓' : 
               toastItem.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span>{toastItem.message}</span>
            <button
              onClick={() => toast.removeToast(toastItem.id)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
