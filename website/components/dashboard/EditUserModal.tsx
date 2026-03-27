'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

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

interface EditUserModalProps {
  user: ConvexUser | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditUserModal({ user, isOpen, onClose, onSuccess }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    imageUrl: '',
    role: 'staff' as 'super_admin' | 'admin' | 'staff',
    branchIds: [] as string[]
  })
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  const updateUserMutation = useMutation(api.users.upsertUser)
  const branches = useQuery(api.branches.getBranches) || []

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        bio: user.bio || '',
        imageUrl: user.imageUrl || '',
        role: user.role || 'staff',
        branchIds: user.branchIds ? user.branchIds.map(String) : []
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)
    try {
      await updateUserMutation({
        clerkId: user.clerkId,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email,
        bio: formData.bio || undefined,
        imageUrl: formData.imageUrl || undefined,
        role: formData.role,
        branchIds: formData.branchIds.length > 0
          ? formData.branchIds.map((id) => id as Id<'branches'>)
          : undefined,
      })
      
      toast.success('User updated successfully')
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('Failed to update user')
      console.error('Update error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="First Name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Last Name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Email"
              required
            />
          </div>

          <div>
            <Label htmlFor="imageUrl">Profile Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange('imageUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Staff: No access to System section. Admin: No access to Debugging. Super Admin: Full access.
            </p>
          </div>

          <div>
            <Label>Assign to Branches</Label>
            <div className="mt-1 border border-gray-300 rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <label key={branch._id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={formData.branchIds.includes(String(branch._id))}
                      onChange={(e) => {
                        const id = String(branch._id)
                        setFormData((prev) => ({
                          ...prev,
                          branchIds: e.target.checked
                            ? [...prev.branchIds, id]
                            : prev.branchIds.filter((b) => b !== id),
                        }))
                      }}
                      disabled={isLoading}
                      className="accent-blue-600"
                    />
                    {branch.branchName}
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-400 px-1">Loading branches...</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select one or more branches to assign this user to.
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
