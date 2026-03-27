'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserRole } from '@/hooks/useUserRole'
import { useRouter } from 'next/navigation'
import { getPermissionsForRole } from '@/lib/permissions'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface Branch {
  _id: Id<'branches'>
  _creationTime: number
  branchName: string
  createdAt: number
  updatedAt: number
}

export default function BranchesPage() {
  const userRole = useUserRole()
  const router = useRouter()
  const permissions = getPermissionsForRole(userRole)

  const branches = useQuery(api.branches.getBranches) || []
  const createBranchMutation = useMutation(api.branches.createBranch)
  const updateBranchMutation = useMutation(api.branches.updateBranch)
  const deleteBranchMutation = useMutation(api.branches.deleteBranch)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [branchName, setBranchName] = useState('')

  useEffect(() => {
    if (userRole !== null && !permissions.canAccessUsersManagement) {
      router.push('/dashboard')
    }
  }, [userRole, permissions.canAccessUsersManagement, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!branchName.trim()) {
        setError('Branch Name is required')
        setSaving(false)
        return
      }

      if (editingBranch) {
        // Update existing branch
        await updateBranchMutation({
          id: editingBranch._id,
          branchName: branchName.trim(),
        })
      } else {
        // Create new branch
        await createBranchMutation({
          branchName: branchName.trim(),
        })
      }

      resetForm()
      // No need to show alert - Convex will automatically update the UI
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch)
    setBranchName(branch.branchName)
    setShowForm(true)
  }

  const handleDelete = async (branchId: Id<'branches'>) => {
    if (!confirm('Are you sure you want to delete this branch?')) {
      return
    }

    try {
      await deleteBranchMutation({ id: branchId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch')
    }
  }

  const resetForm = () => {
    setBranchName('')
    setEditingBranch(null)
    setShowForm(false)
  }

  if (userRole === null || !permissions.canAccessUsersManagement) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Branches</h1>
          <p className="text-sm text-muted-foreground">
            Manage company branches
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          Add New Branch
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</CardTitle>
            <CardDescription>
              {editingBranch ? 'Update branch name' : 'Enter branch name'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="branchName">Branch Name *</Label>
                <Input
                  id="branchName"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  placeholder="Enter branch name"
                  maxLength={100}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Branches List</CardTitle>
          <CardDescription>All company branches</CardDescription>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No branches found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-semibold">Branch Name</th>
                    <th className="text-left p-2 font-semibold">Created</th>
                    <th className="text-left p-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{branch.branchName}</td>
                      <td className="p-2">
                        {new Date(branch.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(branch)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(branch._id)}
                            className="text-red-600 hover:text-red-700"
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
