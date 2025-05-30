"use client"

import { useMap } from "@/context/map-context"
import { useSupabase } from "@/context/supabase-context"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"

export function ActiveFilters() {
  const { filter, setFilter } = useMap()
  const { supabase } = useSupabase()
  const [mainCategoryName, setMainCategoryName] = useState<string | null>(null)
  const [subCategoryName, setSubCategoryName] = useState<string | null>(null)

  // Check if there are any active filters
  const hasFilters = !!(
    filter.mainCategoryId ||
    filter.subCategoryId ||
    filter.province ||
    filter.district ||
    filter.neighborhood
  )

  // Load category names
  useEffect(() => {
    async function loadCategoryNames() {
      if (!filter.mainCategoryId && !filter.subCategoryId) {
        setMainCategoryName(null)
        setSubCategoryName(null)
        return
      }

      if (!supabase) return

      if (filter.mainCategoryId) {
        const result = await supabase.selectSingle("main_categories", {
          select: "name",
          filter: { id: filter.mainCategoryId }
        })

        if (result.data) {
          setMainCategoryName(result.data.name)
        }
      }

      if (filter.subCategoryId) {
        const result = await supabase.selectSingle("sub_categories", {
          select: "name",
          filter: { id: filter.subCategoryId }
        })

        if (result.data) {
          setSubCategoryName(result.data.name)
        }
      }
    }

    loadCategoryNames()
  }, [filter.mainCategoryId, filter.subCategoryId, supabase])

  // Remove a specific filter
  const removeFilter = (key: keyof typeof filter) => {
    const newFilter = { ...filter }
    delete newFilter[key]
    setFilter(newFilter)
  }

  if (!hasFilters) return null

  return (
    <div className="absolute top-32 left-4 z-10 bg-gray-800 p-2 rounded-md shadow-md border border-gray-600">
      <div className="flex flex-wrap gap-2">
        {filter.province && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {filter.province}
            <button
              onClick={() => removeFilter("province")}
              className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {filter.district && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {filter.district}
            <button
              onClick={() => removeFilter("district")}
              className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {filter.neighborhood && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {filter.neighborhood}
            <button
              onClick={() => removeFilter("neighborhood")}
              className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {mainCategoryName && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {mainCategoryName}
            <button
              onClick={() => removeFilter("mainCategoryId")}
              className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {subCategoryName && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {subCategoryName}
            <button
              onClick={() => removeFilter("subCategoryId")}
              className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>
    </div>
  )
}
