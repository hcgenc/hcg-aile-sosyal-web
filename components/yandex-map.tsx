"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { loadYandexMapsScript, testYandexApiKeyFetch } from "@/lib/yandex-maps"
import type { MapMode } from "@/context/map-context"

interface YandexMapProps {
  center: [number, number]
  zoom: number
  markers?: Array<{
    id: string
    position: [number, number]
    color?: string
    mainCategoryColor?: string
    subCategoryColor?: string
    letter?: string
    onClick?: () => void
  }>
  onMarkerClick?: (id: string) => void
  onMapClick?: (coords: [number, number]) => void
  draggableMarker?: boolean
  onMarkerDrag?: (coords: [number, number]) => void
  className?: string
  style?: React.CSSProperties
  mode?: MapMode
}

export function YandexMap({
  center,
  zoom,
  markers = [],
  onMarkerClick,
  onMapClick,
  draggableMarker = false,
  onMarkerDrag,
  className = "",
  style = {},
  mode = "map",
}: YandexMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const ymapsRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const draggableMarkerRef = useRef<any>(null)
  const prevPropsRef = useRef({ center, zoom, markers, draggableMarker, mode })
  const [isMapReady, setIsMapReady] = useState(false)

  // Load Yandex Maps API and initialize map
  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      try {
        // Test API key fetching first
        await testYandexApiKeyFetch()
        
        // Load Yandex Maps API
        await loadYandexMapsScript()
        ymapsRef.current = window.ymaps

        if (!isMounted || !mapRef.current || !window.ymaps) return

        // Create map instance
        const map = new window.ymaps.Map(mapRef.current, {
          center,
          zoom,
          controls: ["zoomControl", "fullscreenControl"],
          type: getYandexMapType(mode),
        })

        // Add click event listener
        if (onMapClick) {
          map.events.add("click", (e: any) => {
            const coords = e.get("coords")
            onMapClick([coords[0], coords[1]])
          })
        }

        mapInstanceRef.current = map
        if (isMounted) {
          setIsMapReady(true)
          console.log("Yandex Map initialized successfully")
        }
      } catch (error) {
        console.error("Error initializing Yandex Map:", error)
      }
    }

    if (!mapInstanceRef.current) {
      initMap()
    }

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
        setIsMapReady(false)
      }
    }
  }, []) // Empty dependency array - only run once on mount

  // Helper function to convert our map mode to Yandex map type
  const getYandexMapType = (mode: MapMode): string => {
    switch (mode) {
      case "satellite":
        return "yandex#satellite"
      case "hybrid":
        return "yandex#hybrid"
      case "map":
      default:
        return "yandex#map"
    }
  }

  // Update map when props change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !isMapReady) return

    console.log("Updating map with", markers.length, "markers")

    // Update center and zoom if changed
    const prevProps = prevPropsRef.current
    if (prevProps.center[0] !== center[0] || prevProps.center[1] !== center[1] || prevProps.zoom !== zoom) {
      map.setCenter(center, zoom, { duration: 300 })
    }

    // Update map type if changed
    if (prevProps.mode !== mode) {
      map.setType(getYandexMapType(mode))
    }

    // Update markers - always refresh to ensure they're visible
    const updateMarkers = () => {
      // Clear existing markers
      markersRef.current.forEach((marker) => {
        map.geoObjects.remove(marker)
      })
      markersRef.current = []

      // Add new markers
      markers.forEach((marker) => {
        if (!ymapsRef.current) return

        const placemark = new ymapsRef.current.Placemark(
          marker.position,
          {
            iconContent: marker.letter || "",
          },
          {
            preset: "islands#circleIcon",
            iconColor: marker.subCategoryColor || marker.mainCategoryColor || marker.color || "#3B82F6",
            draggable: false,
          },
        )

        // Add click event
        if (onMarkerClick) {
          placemark.events.add("click", () => {
            onMarkerClick(marker.id)
          })
        }

        if (marker.onClick) {
          placemark.events.add("click", marker.onClick)
        }

        map.geoObjects.add(placemark)
        markersRef.current.push(placemark)
      })

      console.log(`Added ${markers.length} markers to map`)
    }

    // Handle draggable marker
    const updateDraggableMarker = () => {
      // Remove existing draggable marker
      if (draggableMarkerRef.current) {
        map.geoObjects.remove(draggableMarkerRef.current)
        draggableMarkerRef.current = null
      }

      // Add new draggable marker if needed
      if (draggableMarker && ymapsRef.current) {
        const placemark = new ymapsRef.current.Placemark(
          center,
          {},
          {
            preset: "islands#redCircleDotIcon",
            draggable: true,
          },
        )

        if (onMarkerDrag) {
          placemark.events.add("dragend", () => {
            const coords = placemark.geometry.getCoordinates()
            onMarkerDrag([coords[0], coords[1]])
          })
        }

        map.geoObjects.add(placemark)
        draggableMarkerRef.current = placemark
      }
    }

    // Always update markers to ensure they're visible
    updateMarkers()

    // Update draggable marker if needed
    if (
      prevProps.draggableMarker !== draggableMarker ||
      (draggableMarker && (prevProps.center[0] !== center[0] || prevProps.center[1] !== center[1]))
    ) {
      updateDraggableMarker()
    } else if (draggableMarker && draggableMarkerRef.current) {
      // Just update position of existing draggable marker
      draggableMarkerRef.current.geometry.setCoordinates(center)
    }

    // Update prevProps reference
    prevPropsRef.current = { center, zoom, markers, draggableMarker, mode }
  }, [center, zoom, markers, draggableMarker, onMarkerClick, onMarkerDrag, isMapReady, mode])

  return <div ref={mapRef} className={`w-full h-full ${className}`} style={{ ...style }} />
}
