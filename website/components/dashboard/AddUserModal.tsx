'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Generate a unique auto-generated Clerk ID
function generateAutoClerkId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `user_auto_${timestamp}_${random}`
}

export default function AddUserModal({ isOpen, onClose, onSuccess }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    clerkId: '',
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    imageUrl: '',
    role: 'staff' as 'super_admin' | 'admin' | 'staff',
    branchId: '' as string
  })
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  const createUserMutation = useMutation(api.users.upsertUser)
  const branches = useQuery(api.branches.getBranches) || []

  // Auto-generate Clerk ID when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        clerkId: generateAutoClerkId()
      }))
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clerkId.trim() || !formData.email.trim()) {
      toast.error('Clerk ID and Email are required')
      return
    }

    setIsLoading(true)
    try {
      await createUserMutation({
        clerkId: formData.clerkId.trim(),
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        email: formData.email.trim(),
        bio: formData.bio.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        role: formData.role,
        branchId: formData.branchId && formData.branchId.trim() !== '' 
          ? (formData.branchId as Id<'branches'>) 
          : undefined,
      })
      
      toast.success('User created successfully')
      onSuccess()
      onClose()
      // Reset form
      setFormData({
        clerkId: '',
        firstName: '',
        lastName: '',
        email: '',
        bio: '',
        imageUrl: '',
        role: 'staff',
        branchId: ''
      })
    } catch (error) {
      toast.error('Failed to create user')
      console.error('Create error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const regenerateClerkId = () => {
    setFormData(prev => ({
      ...prev,
      clerkId: generateAutoClerkId()
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Add New User</h2>
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
          <div>
            <Label htmlFor="clerkId">Clerk ID *</Label>
            <div className="flex gap-2">
              <Input
                id="clerkId"
                value={formData.clerkId}
                onChange={(e) => handleInputChange('clerkId', e.target.value)}
                placeholder="Auto-generated Clerk ID"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={regenerateClerkId}
                className="px-3"
                title="Generate new Clerk ID"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Auto-generated unique identifier. Click the refresh button to generate a new one.
            </p>
          </div>

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
              placeholder="user@example.com"
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
              placeholder="Tell us about this user..."
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
            <Label htmlFor="branchId">Assign to Branch</Label>
            <select
              id="branchId"
              value={formData.branchId}
              onChange={(e) => handleInputChange('branchId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">No Branch Assigned</option>
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.branchName}
                  </option>
                ))
              ) : (
                <option value="" disabled>Loading branches...</option>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select a branch to assign this user to.
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
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
