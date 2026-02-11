'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

interface UserSearchProps {
  onSearch: (query: string) => void
  onFilterChange: (filter: string) => void
  onClear: () => void
}

export default function UserSearch({ onSearch, onFilterChange, onClear }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  const handleSearch = () => {
    onSearch(searchQuery)
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedFilter(value)
    onFilterChange(value)
  }

  const handleClear = () => {
    setSearchQuery('')
    setSelectedFilter('all')
    onClear()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
      <div className="flex-1 min-w-0">
        <Input
          placeholder="Search users by name, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full text-base h-12 px-4 text-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
        />
      </div>
      
      <Select value={selectedFilter} onChange={handleFilterChange}>
        <option value="all">All Users</option>
        <option value="active">Active</option>
        <option value="recent">Recent</option>
        <option value="with-bio">With Bio</option>
        <option value="no-bio">No Bio</option>
      </Select>

      <div className="flex gap-2 flex-shrink-0">
        <Button 
          onClick={handleSearch}
          className="bg-blue-600 hover:bg-blue-700 h-12 px-6 text-base"
        >
          Search
        </Button>
        <Button 
          variant="outline" 
          onClick={handleClear}
          className="h-12 px-6 text-base"
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
