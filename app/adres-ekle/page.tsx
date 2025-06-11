"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/context/supabase-context"
import { useMap } from "@/context/map-context"
import { MapPinIcon, Check, Search, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { YandexMap } from "@/components/yandex-map"
import { geocodeAddress, geocodeAddressEnhanced, reverseGeocode } from "@/lib/yandex-maps"
import type { MainCategory, SubCategory } from "@/types/categories"
import { useAuth } from "@/context/auth-context"

export default function AddressAddPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { refreshMarkers } = useMap()
  const { logAction } = useAuth()

  const [activeTab, setActiveTab] = useState("manual") // Start with manual tab

  // Koordinat bilgileri
  const [coordinates, setCoordinates] = useState<[number, number]>([39.92, 32.85])
  const [latitude, setLatitude] = useState("39.92")
  const [longitude, setLongitude] = useState("32.85")

  // Adres bilgileri
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState("")
  const [province, setProvince] = useState("")
  const [district, setDistrict] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [address, setAddress] = useState("")

  // Kategori bilgileri
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [selectedMainCategory, setSelectedMainCategory] = useState("")
  const [selectedSubCategory, setSelectedSubCategory] = useState("")

  // Önizleme durumu
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Seçilen ana kategori adı
  const [selectedMainCategoryName, setSelectedMainCategoryName] = useState<string | undefined>(undefined)

  // Ana kategorileri yükle
  useEffect(() => {
    async function loadMainCategories() {
      if (!supabase) return

      const result = await supabase.select("main_categories", {
        select: "*",
        orderBy: { column: "name", ascending: true }
      })

      if (result.error) throw result.error

      if (result.data) {
        setMainCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
          })),
        )
      }
    }

    loadMainCategories()
  }, [supabase])

  // Alt kategorileri yükle (ana kategori seçildiğinde)
  useEffect(() => {
    async function loadSubCategories() {
      if (!supabase || !selectedMainCategory) return

      const result = await supabase.select("sub_categories", {
        select: "*",
        filter: { main_category_id: selectedMainCategory },
        orderBy: { column: "name", ascending: true }
      })

      if (result.error) {
        console.error("Alt kategoriler yüklenirken hata:", result.error)
        toast({
          title: "Hata",
          description: "Alt kategoriler yüklenirken bir sorun oluştu.",
          variant: "destructive",
        })
        return
      }

      if (result.data) {
        setSubCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
          })),
        )
      }
    }

    if (selectedMainCategory) {
      const category = mainCategories.find((c) => c.id === selectedMainCategory)
      setSelectedMainCategoryName(category?.name)

      loadSubCategories()
      setSelectedSubCategory("")
    } else {
      setSubCategories([])
      setSelectedMainCategoryName(undefined)
    }
  }, [supabase, selectedMainCategory, mainCategories])

  // Enhanced address search function
  const searchAddress = async () => {
    // Validate that at least province is provided
    if (!province.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen en az il bilgisini girin.",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)

    try {
      console.log("Starting address search with:", {
        province: province.trim(),
        district: district.trim(),
        neighborhood: neighborhood.trim(),
        address: address.trim(),
      })

      // Use enhanced geocoding
      const result = await geocodeAddressEnhanced(province.trim(), district.trim(), neighborhood.trim(), address.trim())

      if (result && result.coords) {
        // Update coordinates
        setCoordinates(result.coords)
        setLatitude(result.coords[0].toString())
        setLongitude(result.coords[1].toString())

        // Update address fields with geocoded details if they're empty
        if (result.details) {
          if (!province.trim() && result.details.province) {
            setProvince(result.details.province)
          }

          if (!district.trim() && result.details.district) {
            setDistrict(result.details.district)
          }

          if (!neighborhood.trim() && result.details.neighborhood) {
            setNeighborhood(result.details.neighborhood)
          }

          if (!address.trim() && result.details.street) {
            setAddress(result.details.street)
          }
        }

        toast({
          title: "Başarılı",
          description: "Adres bulundu ve haritada gösterildi.",
        })
      } else {
        // Try a simpler search with just the province
        if (province.trim()) {
          const fallbackResult = await geocodeAddress(`${province.trim()}, Türkiye`)

          if (fallbackResult) {
            setCoordinates(fallbackResult)
            setLatitude(fallbackResult[0].toString())
            setLongitude(fallbackResult[1].toString())

            toast({
              title: "Kısmi Sonuç",
              description: `${province} il merkezi gösteriliyor. Daha detaylı adres bilgisi girin veya haritada konumu manuel olarak ayarlayın.`,
            })
          } else {
            toast({
              title: "Uyarı",
              description:
                "Adres bulunamadı. Lütfen daha detaylı bilgi girin veya haritada konumu manuel olarak seçin.",
            })
          }
        }
      }
    } catch (error) {
      console.error("Adres arama hatası:", error)
      toast({
        title: "Hata",
        description: "Adres aranırken bir sorun oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Koordinat bilgilerini güncelle
  const updateCoordinatesFromInput = () => {
    try {
      const lat = Number.parseFloat(latitude)
      const lng = Number.parseFloat(longitude)

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Geçersiz koordinat değerleri")
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error("Koordinat değerleri geçerli aralıkta değil")
      }

      setCoordinates([lat, lng])
    } catch (error) {
      toast({
        title: "Hata",
        description: "Lütfen geçerli koordinat değerleri girin.",
        variant: "destructive",
      })
    }
  }

  // Harita tıklama olayı - useCallback ile memoize ediyoruz
  const handleMapClick = useCallback(
    async (coords: [number, number]) => {
      setCoordinates(coords)
      setLatitude(coords[0].toString())
      setLongitude(coords[1].toString())

      // Adres detaylarını al
      try {
        const addressDetails = await reverseGeocode(coords)

        if (addressDetails) {
          // Sadece boş alanları doldur
          if (!province.trim() && addressDetails.province) {
            setProvince(addressDetails.province)
          }

          if (!district.trim() && addressDetails.district) {
            setDistrict(addressDetails.district)
          }

          if (!neighborhood.trim() && addressDetails.neighborhood) {
            setNeighborhood(addressDetails.neighborhood)
          }

          if (!address.trim() && addressDetails.street) {
            setAddress(addressDetails.street)
          }
        }
      } catch (error) {
        console.error("Adres detayları alınırken hata:", error)
      }
    },
    [province, district, neighborhood, address],
  )

  // Marker sürükleme olayı - useCallback ile memoize ediyoruz
  const handleMarkerDrag = useCallback((coords: [number, number]) => {
    setCoordinates(coords)
    setLatitude(coords[0].toString())
    setLongitude(coords[1].toString())
  }, [])

  // Önizleme modunu aç/kapat
  const togglePreviewMode = () => {
    if (!isPreviewMode && !validateForm()) {
      return
    }

    setIsPreviewMode(!isPreviewMode)
  }

  // Form doğrulama
  const validateForm = () => {
    if (activeTab === "coordinates") {
      try {
        const lat = Number.parseFloat(latitude)
        const lng = Number.parseFloat(longitude)

        if (isNaN(lat) || isNaN(lng)) {
          throw new Error("Geçersiz koordinat değerleri")
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          throw new Error("Koordinat değerleri geçerli aralıkta değil")
        }
      } catch (error) {
        toast({
          title: "Hata",
          description: "Lütfen geçerli koordinat değerleri girin.",
          variant: "destructive",
        })
        return false
      }
    }

    if (!firstName.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen isim girin.",
        variant: "destructive",
      })
      return false
    }

    if (!lastName.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen soyisim girin.",
        variant: "destructive",
      })
      return false
    }

    if (!province.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen il girin.",
        variant: "destructive",
      })
      return false
    }

    if (!district.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen ilçe girin.",
        variant: "destructive",
      })
      return false
    }

    if (!neighborhood.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen mahalle girin.",
        variant: "destructive",
      })
      return false
    }

    if (!address.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen adres girin.",
        variant: "destructive",
      })
      return false
    }

    if (!selectedMainCategory) {
      toast({
        title: "Hata",
        description: "Lütfen bir risk faktörü seçin.",
        variant: "destructive",
      })
      return false
    }

    if (!selectedSubCategory) {
      toast({
        title: "Hata",
        description: "Lütfen bir hizmet türü seçin.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  // Adresi kaydet
  const saveAddress = async () => {
    if (!validateForm() || !supabase) {
      return
    }

    try {
      const [lat, lng] = coordinates

      const result = await supabase.insert("addresses", {
        first_name: firstName,
        last_name: lastName,
        gender: gender || null,
        province: province,
        district: district,
        neighborhood: neighborhood,
        address: address,
        latitude: lat,
        longitude: lng,
        main_category_id: selectedMainCategory,
        sub_category_id: selectedSubCategory,
      })

      if (result.error) {
        throw result.error
      }

      await logAction("ADD_ADDRESS", `Added address: ${firstName} ${lastName} - ${province}, ${district}`)

      toast({
        title: "Başarılı",
        description: "Adres başarıyla kaydedildi.",
      })

      refreshMarkers()
      router.push("/")
    } catch (error) {
      console.error("Adres kaydedilirken hata:", error)
      toast({
        title: "Hata",
        description: "Adres kaydedilirken bir sorun oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      })
    }
  }

  // Marker rengi
  const getMarkerColor = () => {
    if (!selectedMainCategoryName) return "#3B82F6" // Default blue

    switch (selectedMainCategoryName) {
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
  }

  // Memoize preview markers to prevent unnecessary re-renders
  const previewMarkers = useMemo(() => {
    if (!isPreviewMode) return []

    return [
      {
        id: "preview",
        position: coordinates,
        color: getMarkerColor(),
        letter: selectedMainCategoryName ? selectedMainCategoryName.charAt(0) : "?",
      },
    ]
  }, [isPreviewMode, coordinates, selectedMainCategoryName])

  return (
    <div className="container py-10 px-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Adres Ekle</h1>

      {isPreviewMode ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Adres Önizleme</h2>

            <div className="h-[300px] w-full mb-6 rounded-md overflow-hidden shadow-inner">
              <YandexMap
                center={coordinates}
                zoom={13}
                markers={previewMarkers}
                style={{ height: "100%", width: "100%" }}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Kişi Bilgisi</h3>
                <p className="text-lg font-semibold">
                  {firstName} {lastName}
                </p>
                {gender && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {gender}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Koordinatlar</h3>
                <p className="font-mono text-sm">
                  {coordinates[0].toFixed(6)}, {coordinates[1].toFixed(6)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Risk Faktörü</h3>
                <p className="font-semibold">{mainCategories.find((c) => c.id === selectedMainCategory)?.name}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Hizmet Türü</h3>
                <p className="font-semibold">{subCategories.find((c) => c.id === selectedSubCategory)?.name}</p>
              </div>

              <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Adres</h3>
                <p>
                  {province}, {district}, {neighborhood}
                  <br />
                  {address}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="default" onClick={saveAddress} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Onayla ve Kaydet
            </Button>
            <Button variant="outline" onClick={togglePreviewMode}>
              Düzenle
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Adres ile Ekle</TabsTrigger>
              <TabsTrigger value="coordinates">Koordinat ile Ekle</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Adres bilgilerini girin ve "Adres Ara" butonuna tıklayarak haritada görebilirsiniz.
              </p>

              {/* Adres Bilgileri */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">İl *</Label>
                    <Input
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="İl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">İlçe</Label>
                    <Input
                      id="district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="İlçe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Mahalle</Label>
                    <Input
                      id="neighborhood"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Mahalle"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Sokak/Cadde/Adres</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Sokak, cadde, bina no gibi detaylı adres bilgileri"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <Button onClick={searchAddress} variant="outline" className="w-full" disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aranıyor...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Adres Ara
                    </>
                  )}
                </Button>
              </div>

              <div className="h-[300px] w-full rounded-md overflow-hidden shadow-inner">
                <YandexMap
                  center={coordinates}
                  zoom={13}
                  draggableMarker={true}
                  onMarkerDrag={handleMarkerDrag}
                  onMapClick={handleMapClick}
                  style={{ height: "100%", width: "100%" }}
                />
              </div>

              {/* Adres Arama İpuçları */}
              <Alert className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle>Adres Arama İpuçları</AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>En az il bilgisini girmeniz gereklidir</li>
                    <li>Daha doğru sonuçlar için ilçe ve mahalle bilgilerini de girin</li>
                    <li>Sokak adı ve bina numarası gibi detaylar daha kesin sonuçlar verir</li>
                    <li>Sonuç bulunamazsa, haritada marker'ı manuel olarak doğru konuma sürükleyebilirsiniz</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="coordinates" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Enlem (Latitude)</Label>
                  <Input
                    id="latitude"
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="Örn: 39.9255"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Boylam (Longitude)</Label>
                  <Input
                    id="longitude"
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="Örn: 32.8661"
                  />
                </div>
              </div>

              <Button onClick={updateCoordinatesFromInput} variant="outline" className="w-full">
                <MapPinIcon className="h-4 w-4 mr-2" />
                Haritada Göster
              </Button>

              <div className="h-[300px] w-full rounded-md overflow-hidden shadow-inner">
                <YandexMap
                  center={coordinates}
                  zoom={13}
                  draggableMarker={true}
                  onMarkerDrag={handleMarkerDrag}
                  onMapClick={handleMapClick}
                  style={{ height: "100%", width: "100%" }}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Kişisel Bilgiler</h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">İsim</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="İsim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Soyisim</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Soyisim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Cinsiyet</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Cinsiyet seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Erkek">Erkek</SelectItem>
                    <SelectItem value="Kadın">Kadın</SelectItem>
                    <SelectItem value="Belirtmek istemiyorum">Belirtmek istemiyorum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Kategori Bilgileri</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="mainCategory">Risk Faktörü</Label>
                <Select value={selectedMainCategory} onValueChange={setSelectedMainCategory}>
                  <SelectTrigger id="mainCategory">
                    <SelectValue placeholder="Risk faktörü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCategory">Hizmet Türü</Label>
                <Select
                  value={selectedSubCategory}
                  onValueChange={setSelectedSubCategory}
                  disabled={!selectedMainCategory || subCategories.length === 0}
                >
                  <SelectTrigger id="subCategory">
                    <SelectValue placeholder="Hizmet türü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={togglePreviewMode} className="w-full">
            Önizle
          </Button>
        </div>
      )}
    </div>
  )
}
