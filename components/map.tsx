"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useMap } from "@/context/map-context"
import { YandexMap } from "./yandex-map"
import { MarkerPopup } from "./marker-popup"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

export function Map() {
  const {
    markers,
    selectedMarker,
    setSelectedMarker,
    mapCenter,
    mapZoom,
    mapMode,
    highlightedMarkerId,
    isLoading,
    forceRefreshMarkers,
  } = useMap()
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [mapMounted, setMapMounted] = useState(false)

  // Force refresh markers when map component mounts
  useEffect(() => {
    console.log("Map component mounted, forcing marker refresh")
    forceRefreshMarkers()
    setMapMounted(true)
  }, [forceRefreshMarkers])

  // Also refresh when the page becomes visible (user returns from another tab/page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && mapMounted) {
        console.log("Page became visible, refreshing markers")
        forceRefreshMarkers()
      }
    }

    const handleFocus = () => {
      if (mapMounted) {
        console.log("Window focused, refreshing markers")
        forceRefreshMarkers()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [forceRefreshMarkers, mapMounted])

  // Get marker color based on category
  const getMarkerColor = useCallback((marker: any, isHighlighted = false): string => {
    if (isHighlighted) return "#FFD700" // Gold for highlighted markers

    // Önce hizmet türü rengini kullan
    if (marker.subCategoryColor) {
      return marker.subCategoryColor
    }

    // Sonra ana kategori rengini kullan
    if (marker.mainCategoryColor) {
      return marker.mainCategoryColor
    }

    // Fallback olarak kategori ismine göre renk belirle
    if (!marker.mainCategoryName) return "#3B82F6" // Default blue

    switch (marker.mainCategoryName) {
      case "Yaşlı":
        return "#10B981" // Green
      case "Engelli":
        return "#F59E0B" // Orange
      case "Kronik Hastalık":
        return "#EF4444" // Red
      case "Sosyal Destek İhtiyacı":
        return "#8B5CF6" // Purple
      case "Afet Mağduru":
        return "#EC4899" // Pink
      default:
        return "#3B82F6" // Blue
    }
  }, [])

  // Handle marker click with useCallback to prevent unnecessary re-renders
  const handleMarkerClick = useCallback(
    (id: string) => {
      const marker = markers.find((m) => m.id === id)
      if (marker) {
        setSelectedMarker(marker)
        setIsPopupOpen(true)
      }
    },
    [markers, setSelectedMarker],
  )

  // Format markers for YandexMap component - memoize to prevent unnecessary re-renders
  const formattedMarkers = useMemo(
    () =>
      markers.map((marker) => {
        const isHighlighted = highlightedMarkerId === marker.id
        return {
          id: marker.id,
          position: [marker.latitude, marker.longitude] as [number, number],
          color: getMarkerColor(marker, isHighlighted),
          mainCategoryColor: marker.mainCategoryColor,
          subCategoryColor: marker.subCategoryColor,
          letter: marker.mainCategoryName ? marker.mainCategoryName.charAt(0) : "?",
        }
      }),
    [markers, getMarkerColor, highlightedMarkerId],
  )

  // Close popup when selectedMarker is null
  useEffect(() => {
    if (!selectedMarker) {
      setIsPopupOpen(false)
    }
  }, [selectedMarker])

  // Debug logging
  useEffect(() => {
    console.log(`Map component: ${markers.length} markers, loading: ${isLoading}, mounted: ${mapMounted}`)
  }, [markers.length, isLoading, mapMounted])

  return (
    <>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-gray-900/50 flex items-center justify-center">
          <div className="bg-gray-800 p-4 rounded-lg flex items-center gap-3 border border-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <span className="text-gray-200">Harita yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Marker count indicator - positioned below the map view button */}
      {mapMounted && (
        <div className="absolute top-52 right-4 z-10 bg-gray-800 px-3 py-2 rounded-md text-sm text-gray-200 border border-gray-600 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>{markers.length}</span>
          </div>
        </div>
      )}

      <YandexMap
        center={mapCenter}
        zoom={mapZoom}
        markers={formattedMarkers}
        onMarkerClick={handleMarkerClick}
        className="w-full h-screen"
        mode={mapMode}
      />

      {/* Marker Popup Dialog */}
      <Dialog
        open={isPopupOpen && !!selectedMarker}
        onOpenChange={(open) => {
          setIsPopupOpen(open)
          if (!open) setSelectedMarker(null)
        }}
      >
        <DialogContent className="p-0 border-none max-w-md">
          {selectedMarker && <MarkerPopup marker={selectedMarker} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
