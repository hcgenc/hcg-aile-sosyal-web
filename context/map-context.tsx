"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSupabase } from "./supabase-context"
import { toast } from "@/components/ui/use-toast"

export type Marker = {
  id: string
  latitude: number
  longitude: number
  firstName: string
  lastName: string
  province: string
  district: string
  neighborhood: string
  address: string
  mainCategoryId: string
  subCategoryId: string
  mainCategoryName?: string
  subCategoryName?: string
  createdAt?: string
}

export type Filter = {
  mainCategoryId?: string
  subCategoryId?: string
  province?: string
  district?: string
  neighborhood?: string
}

export type MapMode = "map" | "satellite" | "hybrid"

type MapContextType = {
  markers: Marker[]
  selectedMarker: Marker | null
  setSelectedMarker: (marker: Marker | null) => void
  filter: Filter
  setFilter: (filter: Filter) => void
  refreshMarkers: () => Promise<void>
  forceRefreshMarkers: () => Promise<void>
  mapCenter: [number, number]
  setMapCenter: (center: [number, number]) => void
  mapZoom: number
  setMapZoom: (zoom: number) => void
  mapMode: MapMode
  setMapMode: (mode: MapMode) => void
  provinces: string[]
  districts: string[]
  neighborhoods: string[]
  loadLocationOptions: () => Promise<void>
  highlightedMarkerId: string | null
  setHighlightedMarkerId: (id: string | null) => void
  isLoading: boolean
}

const MapContext = createContext<MapContextType>({
  markers: [],
  selectedMarker: null,
  setSelectedMarker: () => {},
  filter: {},
  setFilter: () => {},
  refreshMarkers: async () => {},
  forceRefreshMarkers: async () => {},
  mapCenter: [39.92, 32.85], // Ankara, Turkey
  setMapCenter: () => {},
  mapZoom: 6,
  setMapZoom: () => {},
  mapMode: "map",
  setMapMode: () => {},
  provinces: [],
  districts: [],
  neighborhoods: [],
  loadLocationOptions: async () => {},
  highlightedMarkerId: null,
  setHighlightedMarkerId: () => {},
  isLoading: false,
})

export const useMap = () => useContext(MapContext)

export const MapProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase()
  const [markers, setMarkers] = useState<Marker[]>([])
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null)
  const [filter, setFilter] = useState<Filter>({})
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.92, 32.85]) // Ankara, Turkey
  const [mapZoom, setMapZoom] = useState(6)
  const [mapMode, setMapMode] = useState<MapMode>("map")
  const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Location filter options
  const [provinces, setProvinces] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])

  const loadMarkers = useCallback(
    async (forceRefresh = false) => {
      if (!supabase) {
        console.log("Supabase not available for marker loading")
        return
      }

      // Don't show loading for force refresh to avoid flickering
      if (!forceRefresh) {
        setIsLoading(true)
      }

      console.log("Loading markers with filter:", filter, "Force refresh:", forceRefresh)

      try {
        let query = supabase.from("addresses").select(`
        *,
        main_categories(name),
        sub_categories(name)
      `)

        if (filter.mainCategoryId) {
          query = query.eq("main_category_id", filter.mainCategoryId)
        }

        if (filter.subCategoryId) {
          query = query.eq("sub_category_id", filter.subCategoryId)
        }

        if (filter.province) {
          query = query.eq("province", filter.province)
        }

        if (filter.district) {
          query = query.eq("district", filter.district)
        }

        if (filter.neighborhood) {
          query = query.eq("neighborhood", filter.neighborhood)
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        if (data) {
          const formattedMarkers = data.map((item) => ({
            id: item.id,
            latitude: item.latitude,
            longitude: item.longitude,
            firstName: item.first_name,
            lastName: item.last_name,
            province: item.province,
            district: item.district,
            neighborhood: item.neighborhood,
            address: item.address,
            mainCategoryId: item.main_category_id,
            subCategoryId: item.sub_category_id,
            mainCategoryName: item.main_categories?.name,
            subCategoryName: item.sub_categories?.name,
            createdAt: item.created_at,
          }))

          console.log(`Successfully loaded ${formattedMarkers.length} markers`)
          setMarkers(formattedMarkers)
        }
      } catch (error) {
        console.error("Adresler yüklenirken hata oluştu:", error)
        toast({
          title: "Hata",
          description: "Adresler yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
          variant: "destructive",
        })
      } finally {
        if (!forceRefresh) {
          setIsLoading(false)
        }
      }
    },
    [supabase, filter],
  )

  // Regular refresh function
  const refreshMarkers = useCallback(async () => {
    await loadMarkers(false)
  }, [loadMarkers])

  // Force refresh function (without loading indicator)
  const forceRefreshMarkers = useCallback(async () => {
    await loadMarkers(true)
  }, [loadMarkers])

  // Load location filter options
  const loadLocationOptions = useCallback(async () => {
    if (!supabase) return

    try {
      // Always load all provinces
      const { data: provinceData, error: provinceError } = await supabase
        .from("addresses")
        .select("province")
        .order("province")

      if (provinceError) throw provinceError

      if (provinceData) {
        const uniqueProvinces = [...new Set(provinceData.map((item) => item.province))]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "tr"))
        setProvinces(uniqueProvinces)
      }

      // Load districts based on selected province
      if (filter.province) {
        const { data: districtData, error: districtError } = await supabase
          .from("addresses")
          .select("district")
          .eq("province", filter.province)
          .order("district")

        if (districtError) throw districtError

        if (districtData) {
          const uniqueDistricts = [...new Set(districtData.map((item) => item.district))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "tr"))
          setDistricts(uniqueDistricts)
        }
      } else {
        setDistricts([])
      }

      // Load neighborhoods based on selected district and province
      if (filter.province && filter.district) {
        const { data: neighborhoodData, error: neighborhoodError } = await supabase
          .from("addresses")
          .select("neighborhood")
          .eq("province", filter.province)
          .eq("district", filter.district)
          .order("neighborhood")

        if (neighborhoodError) throw neighborhoodError

        if (neighborhoodData) {
          const uniqueNeighborhoods = [...new Set(neighborhoodData.map((item) => item.neighborhood))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "tr"))
          setNeighborhoods(uniqueNeighborhoods)
        }
      } else {
        setNeighborhoods([])
      }
    } catch (error) {
      console.error("Konum seçenekleri yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Konum seçenekleri yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, filter.province, filter.district])

  // Update the setFilter function to handle cascading resets
  const setFilterWithCascade = useCallback(
    (newFilter: Filter) => {
      const currentFilter = { ...filter }

      // If province changed, reset district and neighborhood
      if (newFilter.province !== currentFilter.province) {
        delete newFilter.district
        delete newFilter.neighborhood
      }

      // If district changed, reset neighborhood
      if (newFilter.district !== currentFilter.district) {
        delete newFilter.neighborhood
      }

      setFilter(newFilter)
    },
    [filter, setFilter],
  )

  // Load initial data when supabase becomes available
  useEffect(() => {
    if (supabase) {
      console.log("Supabase available, loading initial data")
      refreshMarkers()
      loadLocationOptions()
    }
  }, [supabase, refreshMarkers, loadLocationOptions])

  // Refresh markers when filter changes
  useEffect(() => {
    if (supabase) {
      console.log("Filter changed, refreshing markers")
      refreshMarkers()
    }
  }, [supabase, filter, refreshMarkers])

  return (
    <MapContext.Provider
      value={{
        markers,
        selectedMarker,
        setSelectedMarker,
        filter,
        setFilter: setFilterWithCascade,
        refreshMarkers,
        forceRefreshMarkers,
        mapCenter,
        setMapCenter,
        mapZoom,
        setMapZoom,
        mapMode,
        setMapMode,
        provinces,
        districts,
        neighborhoods,
        loadLocationOptions,
        highlightedMarkerId,
        setHighlightedMarkerId,
        isLoading,
      }}
    >
      {children}
    </MapContext.Provider>
  )
}
