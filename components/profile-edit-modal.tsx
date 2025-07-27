"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSupabase } from "@/context/supabase-context"
import { useAuth } from "@/context/auth-context"
import { useMap } from "@/context/map-context"
import { useToast } from "@/hooks/use-toast"
import type { Marker, MapMode } from "@/context/map-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, X, User, MapPin, Home, Tag, Map, Satellite, Globe, AlertCircle } from "lucide-react"
import { YandexMap } from "@/components/yandex-map"
import { geocodeAddressEnhanced, reverseGeocode } from "@/lib/yandex-maps"

interface ProfileEditModalProps {
  marker: Marker | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  firstName: string
  lastName: string
  gender: string
  province: string
  district: string
  neighborhood: string
  address: string
  mainCategoryId: string
  subCategoryId: string
  latitude: number
  longitude: number
}

export function ProfileEditModal({ marker, isOpen, onOpenChange }: ProfileEditModalProps) {
  const { supabase } = useSupabase()
  const { hasPermission, user } = useAuth()
  const { refreshMarkers } = useMap()
  const { toast } = useToast()

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    gender: "",
    province: "",
    district: "",
    neighborhood: "",
    address: "",
    mainCategoryId: "",
    subCategoryId: "",
    latitude: 0,
    longitude: 0,
  })

  const [mainCategories, setMainCategories] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>("map")
  const [mapCoordinates, setMapCoordinates] = useState<[number, number]>([0, 0])
  const [isGeocoding, setIsGeocoding] = useState(false)

  // Check if user has permission to edit
  const canEdit = hasPermission("EDIT_ADDRESS")
  
  // Log current user for debugging
  useEffect(() => {
    if (isOpen) {
      console.log("Current user:", user)
      console.log("Can edit addresses:", canEdit)
    }
  }, [isOpen, user, canEdit])

  // Load form data when marker changes
  useEffect(() => {
    if (marker && isOpen) {
      const initialFormData = {
        firstName: marker.firstName || "",
        lastName: marker.lastName || "",
        gender: marker.gender || "",
        province: marker.province || "",
        district: marker.district || "",
        neighborhood: marker.neighborhood || "",
        address: marker.address || "",
        mainCategoryId: marker.mainCategoryId || "",
        subCategoryId: marker.subCategoryId || "",
        latitude: marker.latitude || 0,
        longitude: marker.longitude || 0,
      }
      setFormData(initialFormData)
      setMapCoordinates([marker.latitude || 0, marker.longitude || 0])
    }
  }, [marker, isOpen])

  // Load categories
  useEffect(() => {
    if (isOpen && supabase) {
      loadCategories()
    }
  }, [isOpen, supabase])

  const loadCategories = async () => {
    if (!supabase) return

    try {
      setIsLoading(true)

      // Load main categories
      const mainCategoriesResult = await supabase.select("main_categories", {
        select: "id, name, color",
        orderBy: { column: "name", ascending: true },
      })

      if (mainCategoriesResult.error) throw mainCategoriesResult.error
      setMainCategories(mainCategoriesResult.data || [])

      // Load sub categories
      const subCategoriesResult = await supabase.select("sub_categories", {
        select: "id, name, color, main_category_id",
        orderBy: { column: "name", ascending: true },
      })

      if (subCategoriesResult.error) throw subCategoriesResult.error
      setSubCategories(subCategoriesResult.data || [])
    } catch (error) {
      console.error("Error loading categories:", error)
      toast({
        title: "Hata",
        description: "Kategoriler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter sub categories based on selected main category
  const filteredSubCategories = subCategories.filter(
    (sub) => sub.main_category_id === formData.mainCategoryId
  )

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear sub category when main category changes
    if (field === "mainCategoryId") {
      setFormData((prev) => ({ ...prev, subCategoryId: "" }))
    }

    // Update map coordinates when latitude or longitude changes
    if (field === "latitude" || field === "longitude") {
      const lat = field === "latitude" ? Number(value) : formData.latitude
      const lng = field === "longitude" ? Number(value) : formData.longitude
      if (!isNaN(lat) && !isNaN(lng)) {
        setMapCoordinates([lat, lng])
      }
    }
  }

  // Geocode address when address fields change
  const geocodeCurrentAddress = useCallback(async () => {
    if (!formData.province.trim()) return

    setIsGeocoding(true)
    try {
      const result = await geocodeAddressEnhanced(
        formData.province.trim(),
        formData.district.trim(),
        formData.neighborhood.trim(),
        formData.address.trim()
      )

      if (result && result.coords) {
        const [lat, lng] = result.coords
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))
        setMapCoordinates([lat, lng])
      }
    } catch (error) {
      console.error("Geocoding error:", error)
    } finally {
      setIsGeocoding(false)
    }
  }, [formData.province, formData.district, formData.neighborhood, formData.address])

  // Handle map click
  const handleMapClick = useCallback(async (coords: [number, number]) => {
    setMapCoordinates(coords)
    setFormData(prev => ({ ...prev, latitude: coords[0], longitude: coords[1] }))

    // Try to get address details from coordinates
    try {
      const addressDetails = await reverseGeocode(coords)
      if (addressDetails) {
        setFormData(prev => ({
          ...prev,
          province: addressDetails.province || prev.province,
          district: addressDetails.district || prev.district,
          neighborhood: addressDetails.neighborhood || prev.neighborhood,
          address: addressDetails.street || prev.address,
        }))
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error)
    }
  }, [])

  // Handle marker drag
  const handleMarkerDrag = useCallback((coords: [number, number]) => {
    setMapCoordinates(coords)
    setFormData(prev => ({ ...prev, latitude: coords[0], longitude: coords[1] }))
  }, [])

  const handleSave = async () => {
    if (!supabase || !marker) {
      console.error("Missing requirements:", { supabase: !!supabase, marker: !!marker })
      return
    }

    if (!canEdit) {
      console.error("User doesn't have edit permission. User role:", user?.role)
      toast({
        title: "Yetki Hatası",
        description: "Bu işlem için yetkiniz bulunmamaktadır.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      // Validate required fields
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        toast({
          title: "Hata",
          description: "Ad ve soyad alanları zorunludur.",
          variant: "destructive",
        })
        return
      }

      if (!formData.mainCategoryId || !formData.subCategoryId) {
        toast({
          title: "Hata",
          description: "Ana kategori ve hizmet türü seçimi zorunludur.",
          variant: "destructive",
        })
        return
      }

      // Update address in database
      const updateResult = await supabase.update(
        "addresses",
        {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          gender: formData.gender || null,
          province: formData.province.trim(),
          district: formData.district.trim(),
          neighborhood: formData.neighborhood.trim(),
          address: formData.address.trim(),
          main_category_id: formData.mainCategoryId,
          sub_category_id: formData.subCategoryId,
          latitude: formData.latitude,
          longitude: formData.longitude,
        },
        { id: marker.id },
        "*" // Return the updated record
      )

      if (updateResult.error) {
        // Check for authentication errors
        if (updateResult.error.message?.includes('authentication') || 
            updateResult.error.message?.includes('401') || 
            updateResult.error.message?.includes('Unauthorized') ||
            updateResult.error.message?.includes('Invalid authentication token')) {
          toast({
            title: "Oturum Süresi Doldu",
            description: "Lütfen tekrar giriş yapın.",
            variant: "destructive",
          })
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/'
          }, 2000)
          return
        }
        throw updateResult.error
      }

      toast({
        title: "Başarılı",
        description: "Kişi bilgileri başarıyla güncellendi.",
      })

      // Refresh markers to show updated data
      await refreshMarkers()

      // Close modal
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error updating profile:", error)
      
      let errorMessage = "Bilgiler güncellenirken bir sorun oluştu."
      
      if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Güncelleme Hatası", 
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Get marker color for mini map
  const getMarkerColor = () => {
    if (!formData.mainCategoryId) return "#3B82F6"
    const selectedCategory = mainCategories.find(cat => cat.id === formData.mainCategoryId)
    return selectedCategory?.color || "#3B82F6"
  }

  // Preview markers for mini map
  const previewMarkers = useMemo(() => {
    if (!mapCoordinates[0] || !mapCoordinates[1]) return []
    
    const selectedMainCategory = mainCategories.find(cat => cat.id === formData.mainCategoryId)
    
    return [{
      id: "preview",
      position: mapCoordinates,
      color: getMarkerColor(),
      letter: selectedMainCategory ? selectedMainCategory.name.charAt(0) : "?",
    }]
  }, [mapCoordinates, formData.mainCategoryId, mainCategories])

  if (!marker) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto" hideClose>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Kişi Bilgilerini Düzenle
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {marker.firstName} {marker.lastName} için bilgileri güncelleyin
          </p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="col-span-2 space-y-6">
            {!canEdit ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <h3 className="font-medium text-red-800 dark:text-red-300">Yetkisiz Erişim</h3>
                    <p className="text-sm text-red-600 dark:text-red-400">Bu kaydı düzenlemek için yetkiniz bulunmuyor.</p>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm text-muted-foreground">Yükleniyor...</p>
              </div>
            ) : (
              <>
              {/* Personal Information */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-4">Kişisel Bilgiler</h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">İsim *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="İsim"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Soyisim *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Soyisim"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Cinsiyet</Label>
                    <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Cinsiyet seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Erkek">Erkek</SelectItem>
                        <SelectItem value="Kadın">Kadın</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Category Information */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-4">Kategori Bilgileri</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="mainCategory">Risk Faktörü *</Label>
                    <Select value={formData.mainCategoryId} onValueChange={(value) => handleInputChange("mainCategoryId", value)}>
                      <SelectTrigger id="mainCategory">
                        <SelectValue placeholder="Risk faktörü seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded-full shadow-md relative overflow-hidden"
                                style={{ 
                                  backgroundColor: category.color,
                                  boxShadow: `0 2px 6px ${category.color}30`
                                }}
                              >
                                <div 
                                  className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                                />
                              </div>
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subCategory">Hizmet Türü *</Label>
                    <Select
                      value={formData.subCategoryId}
                      onValueChange={(value) => handleInputChange("subCategoryId", value)}
                      disabled={!formData.mainCategoryId || filteredSubCategories.length === 0}
                    >
                      <SelectTrigger id="subCategory">
                        <SelectValue placeholder="Hizmet türü seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded-full shadow-md relative overflow-hidden"
                                style={{ 
                                  backgroundColor: category.color,
                                  boxShadow: `0 2px 6px ${category.color}30`
                                }}
                              >
                                <div 
                                  className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                                />
                              </div>
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-4">Konum Bilgileri</h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">İl</Label>
                    <Input
                      id="province"
                      value={formData.province}
                      onChange={(e) => handleInputChange("province", e.target.value)}
                      placeholder="İl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">İlçe</Label>
                    <Input
                      id="district"
                      value={formData.district}
                      onChange={(e) => handleInputChange("district", e.target.value)}
                      placeholder="İlçe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Mahalle</Label>
                    <Input
                      id="neighborhood"
                      value={formData.neighborhood}
                      onChange={(e) => handleInputChange("neighborhood", e.target.value)}
                      placeholder="Mahalle"
                    />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="address">Sokak/Cadde/Adres</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Sokak, cadde, bina no gibi detaylı adres bilgileri"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Enlem (Latitude)</Label>
                    <Input
                      id="latitude"
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => handleInputChange("latitude", parseFloat(e.target.value) || 0)}
                      placeholder="Örn: 39.9255"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Boylam (Longitude)</Label>
                    <Input
                      id="longitude"
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => handleInputChange("longitude", parseFloat(e.target.value) || 0)}
                      placeholder="Örn: 32.8661"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Güncelle
                    </>
                  )}
                </Button>
              </div>
            </>
            )}
          </div>

          {/* Right Column - Mini Map */}
          <div className="space-y-4">
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Konum Önizleme</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant={mapMode === "map" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapMode("map")}
                    className="p-2"
                  >
                    <Map className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={mapMode === "satellite" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapMode("satellite")}
                    className="p-2"
                  >
                    <Satellite className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={mapMode === "hybrid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapMode("hybrid")}
                    className="p-2"
                  >
                    <Globe className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="h-[300px] w-full rounded-md overflow-hidden border shadow-sm">
                <YandexMap
                  center={mapCoordinates}
                  zoom={15}
                  markers={previewMarkers}
                  onMapClick={handleMapClick}
                  draggableMarker={true}
                  onMarkerDrag={handleMarkerDrag}
                  mode={mapMode}
                  style={{ height: "100%", width: "100%" }}
                />
              </div>

              <div className="mt-4 space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={geocodeCurrentAddress}
                  disabled={isGeocoding || !formData.province.trim()}
                  className="w-full"
                >
                  {isGeocoding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Aranıyor...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      Adresi Haritada Göster
                    </>
                  )}
                </Button>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Koordinatlar:</p>
                  <p className="font-mono">
                    {mapCoordinates[0].toFixed(6)}, {mapCoordinates[1].toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}