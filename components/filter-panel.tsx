"use client"

import { useState, useEffect } from "react"
import { Filter, Layers, MapPin, MapIcon } from "lucide-react"
import { useMap } from "@/context/map-context"
import { useSupabase } from "@/context/supabase-context"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import type { MainCategory, SubCategory } from "@/types/categories"
import type { MapMode } from "@/context/map-context"

export function FilterPanel() {
  const { filter, setFilter, mapMode, setMapMode, provinces, districts, neighborhoods, loadLocationOptions, markers } =
    useMap()
  const { supabase } = useSupabase()
  const { user } = useAuth()

  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])

  const [selectedMainCategory, setSelectedMainCategory] = useState<string | undefined>(filter.mainCategoryId)
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>(filter.subCategoryId)
  const [selectedProvince, setSelectedProvince] = useState<string | undefined>(filter.province)
  const [selectedDistrict, setSelectedDistrict] = useState<string | undefined>(filter.district)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | undefined>(filter.neighborhood)

  // Harita modu için state
  const [mapTypeOpen, setMapTypeOpen] = useState(false)

  // Active filter count - calculate from current markers and filter
  const [activeFilterCount, setActiveFilterCount] = useState(0)
  const [filteredMarkerCount, setFilteredMarkerCount] = useState(0)

  // Ana kategorileri yükle
  useEffect(() => {
    async function loadMainCategories() {
      if (!supabase) return

      const result = await supabase.select("main_categories", {
        select: "*",
        orderBy: { column: "name", ascending: true }
      })

      if (result.error) {
        console.error("Ana kategoriler yüklenirken hata:", result.error)
        return
      }

      if (result.data) {
        setMainCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            color: item.color || "#3B82F6",
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
        return
      }

      if (result.data) {
        setSubCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
            color: item.color || "#3B82F6",
          })),
        )
      }
    }

    if (selectedMainCategory) {
      loadSubCategories()
    } else {
      setSubCategories([])
    }
  }, [supabase, selectedMainCategory])

  // Update active filter count and marker count
  useEffect(() => {
    let count = 0
    if (filter.mainCategoryId) count++
    if (filter.subCategoryId) count++
    // İl filtrelemesi sadece admin kullanıcılar için sayılır
    if (filter.province && user?.role === 'admin') count++
    if (filter.district) count++
    if (filter.neighborhood) count++

    setActiveFilterCount(count)
    setFilteredMarkerCount(markers.length)
  }, [filter, markers, user])

  // Sync local state with filter when filter changes externally
  useEffect(() => {
    setSelectedMainCategory(filter.mainCategoryId)
    setSelectedSubCategory(filter.subCategoryId)
    setSelectedProvince(filter.province)
    setSelectedDistrict(filter.district)
    setSelectedNeighborhood(filter.neighborhood)
  }, [filter])

  // Load location options when filter changes
  useEffect(() => {
    loadLocationOptions()
  }, [loadLocationOptions])

  // Filtreleri uygula
  const applyFilters = () => {
    const newFilter: any = {}

    if (selectedMainCategory) newFilter.mainCategoryId = selectedMainCategory
    if (selectedSubCategory) newFilter.subCategoryId = selectedSubCategory
    if (selectedProvince) newFilter.province = selectedProvince
    if (selectedDistrict) newFilter.district = selectedDistrict
    if (selectedNeighborhood) newFilter.neighborhood = selectedNeighborhood

    setFilter(newFilter)
  }

  // Filtreleri temizle
  const clearFilters = () => {
    setSelectedMainCategory(undefined)
    setSelectedSubCategory(undefined)
    // İl filtrelemesi sadece admin kullanıcılar için temizlenir
    if (user?.role === 'admin') {
      setSelectedProvince(undefined)
    }
    setSelectedDistrict(undefined)
    setSelectedNeighborhood(undefined)
    setFilter({})
  }

  // Harita tipini değiştir
  const changeMapType = (value: MapMode) => {
    setMapMode(value)
    setMapTypeOpen(false)
  }

  // Handle province change with cascading reset
  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value)
    setSelectedDistrict(undefined)
    setSelectedNeighborhood(undefined)
  }

  // Handle district change with cascading reset
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value)
    setSelectedNeighborhood(undefined)
  }

  // Handle main category change with cascading reset
  const handleMainCategoryChange = (value: string) => {
    setSelectedMainCategory(value)
    setSelectedSubCategory(undefined)
  }

  return (
    <div className="absolute top-20 right-4 z-10 flex flex-col gap-2">
      {/* Filtre Butonu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="default" size="sm" className="h-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            Filtrele
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-gray-700 text-gray-100">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="overflow-y-auto bg-gray-800 border-gray-700 text-gray-100">
          <SheetHeader className="space-y-3">
            <SheetTitle className="text-gray-100">Filtreleme Seçenekleri</SheetTitle>
            {/* Result count positioned below title */}
            <div className="flex justify-center">
              <Badge variant="outline" className="border-gray-600 text-gray-300 bg-gray-700/50 text-sm px-3 py-1">
                {filteredMarkerCount} sonuç bulundu
              </Badge>
            </div>
          </SheetHeader>

          <div className="py-6">
            <Tabs defaultValue="location" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-700">
                <TabsTrigger
                  value="location"
                  className="data-[state=active]:bg-gray-600 data-[state=active]:text-gray-100"
                >
                  Konum
                </TabsTrigger>
                <TabsTrigger
                  value="category"
                  className="data-[state=active]:bg-gray-600 data-[state=active]:text-gray-100"
                >
                  Kategori
                </TabsTrigger>
              </TabsList>

              <TabsContent value="location" className="space-y-4">
                {/* İl filtresi sadece admin kullanıcılar için gösterilir */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="province" className="text-gray-200">
                      İl
                    </Label>
                    <Select value={selectedProvince} onValueChange={handleProvinceChange}>
                      <SelectTrigger id="province" className="bg-gray-700 border-gray-600 text-gray-100">
                        <SelectValue placeholder="İl seçin" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        {provinces.map((province) => (
                          <SelectItem key={province} value={province} className="text-gray-100 focus:bg-gray-600">
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Normal/Editor kullanıcılar için şehir bilgisi gösterimi */}
                {user?.role !== 'admin' && user?.city && (
                  <div className="space-y-2">
                    <Label className="text-gray-200">Şehir</Label>
                    <div className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300 text-sm">
                      📍 {user.city} (Kayıtlı Şehriniz)
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="district" className="text-gray-200">
                    İlçe
                  </Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={handleDistrictChange}
                    disabled={districts.length === 0}
                  >
                    <SelectTrigger id="district" className="bg-gray-700 border-gray-600 text-gray-100">
                      <SelectValue placeholder={
                        user?.role === 'admin' 
                          ? (selectedProvince ? "İlçe seçin" : "Önce il seçin")
                          : (districts.length > 0 ? "İlçe seçin" : `${user?.city || 'Şehriniz'}de ilçe bulunamadı`)
                      } />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {districts.map((district) => (
                        <SelectItem key={district} value={district} className="text-gray-100 focus:bg-gray-600">
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-gray-200">
                    Mahalle
                  </Label>
                  <Select
                    value={selectedNeighborhood}
                    onValueChange={setSelectedNeighborhood}
                    disabled={!selectedDistrict || neighborhoods.length === 0}
                  >
                    <SelectTrigger id="neighborhood" className="bg-gray-700 border-gray-600 text-gray-100">
                      <SelectValue placeholder={selectedDistrict ? "Mahalle seçin" : "Önce ilçe seçin"} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {neighborhoods.map((neighborhood) => (
                        <SelectItem key={neighborhood} value={neighborhood} className="text-gray-100 focus:bg-gray-600">
                          {neighborhood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="category" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="main-category" className="text-gray-200">
                    Risk Faktörü
                  </Label>
                  <Select value={selectedMainCategory} onValueChange={handleMainCategoryChange}>
                    <SelectTrigger id="main-category" className="bg-gray-700 border-gray-600 text-gray-100">
                      <SelectValue placeholder="Risk faktörü seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {mainCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id} className="text-gray-100 focus:bg-gray-600">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                              style={{ 
                                backgroundColor: category.color,
                                boxShadow: `0 1px 3px ${category.color}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
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
                  <Label htmlFor="sub-category" className="text-gray-200">
                    Hizmet Türü
                  </Label>
                  <Select
                    value={selectedSubCategory}
                    onValueChange={setSelectedSubCategory}
                    disabled={!selectedMainCategory || subCategories.length === 0}
                  >
                    <SelectTrigger id="sub-category" className="bg-gray-700 border-gray-600 text-gray-100">
                      <SelectValue
                        placeholder={selectedMainCategory ? "Hizmet türü seçin" : "Önce risk faktörü seçin"}
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {subCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id} className="text-gray-100 focus:bg-gray-600">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                              style={{ 
                                backgroundColor: category.color,
                                boxShadow: `0 1px 3px ${category.color}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
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
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-6">
              <Button variant="default" onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white">
                Uygula
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="border-gray-600 text-gray-200 hover:bg-gray-700"
              >
                Temizle
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Harita Modu Butonu */}
      <Sheet open={mapTypeOpen} onOpenChange={setMapTypeOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-4 py-2 bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600"
          >
            {mapMode === "map" && <MapIcon className="h-4 w-4 mr-2" />}
            {mapMode === "satellite" && <Layers className="h-4 w-4 mr-2" />}
            {mapMode === "hybrid" && <MapPin className="h-4 w-4 mr-2" />}
            {mapMode === "map" && "Sokak Görünümü"}
            {mapMode === "satellite" && "Uydu Görünümü"}
            {mapMode === "hybrid" && "Hibrit Görünüm"}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] bg-gray-800 border-gray-700 text-gray-100">
          <SheetHeader>
            <SheetTitle className="text-gray-100">Harita Modu</SheetTitle>
          </SheetHeader>

          <div className="py-6">
            <RadioGroup value={mapMode} onValueChange={(value: MapMode) => changeMapType(value)}>
              <div className="flex items-center space-x-2 mb-4">
                <RadioGroupItem value="map" id="map" className="border-gray-600 text-blue-400" />
                <Label htmlFor="map" className="flex items-center text-gray-200">
                  <MapIcon className="h-4 w-4 mr-2" />
                  Sokak Görünümü
                </Label>
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <RadioGroupItem value="satellite" id="satellite" className="border-gray-600 text-blue-400" />
                <Label htmlFor="satellite" className="flex items-center text-gray-200">
                  <Layers className="h-4 w-4 mr-2" />
                  Uydu Görünümü
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hybrid" id="hybrid" className="border-gray-600 text-blue-400" />
                <Label htmlFor="hybrid" className="flex items-center text-gray-200">
                  <MapPin className="h-4 w-4 mr-2" />
                  Hibrit Görünüm
                </Label>
              </div>
            </RadioGroup>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
