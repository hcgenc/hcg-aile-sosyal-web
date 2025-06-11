"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/context/supabase-context"
import { useMap } from "@/context/map-context"
import { useAuth } from "@/context/auth-context"
import { Trash2, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import type { Marker } from "@/context/map-context"

export default function ServiceListPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { refreshMarkers, setMapCenter, setMapZoom, setHighlightedMarkerId, setSelectedMarker } = useMap()
  const { user, hasPermission, logAction } = useAuth()

  const [addresses, setAddresses] = useState<Marker[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Adresleri getir
  const loadAddresses = async () => {
    if (!supabase) return

    setIsLoading(true)

    try {
      // Rol bazlı şehir filtrelemesi için query options
      const queryOptions: any = {
        select: "*",
        orderBy: { column: "first_name", ascending: true }
      }

      // Rol bazlı şehir filtrelemesi
      if (user) {
        if (user.role === 'normal' || user.role === 'editor') {
          // Normal ve Editor kullanıcılar sadece kendi şehirlerindeki verileri görebilir
          if (user.city) {
            queryOptions.filter = { province: user.city }
          } else {
            // Eğer kullanıcının şehri yoksa hiçbir veri gösterme
            setAddresses([])
            setIsLoading(false)
            return
          }
        }
        // Admin kullanıcılar tüm verileri görebilir (hiçbir ek filtreleme yok)
      }

      // Ana adres verilerini proxy üzerinden al
      const addressResult = await supabase.select("addresses", queryOptions)

      if (addressResult.error) throw addressResult.error

      if (addressResult.data) {
        // Kategorileri ayrı ayrı al
        const mainCategoriesResult = await supabase.select("main_categories", {
          select: "*"
        })
        
        const subCategoriesResult = await supabase.select("sub_categories", {
          select: "*"
        })

        const mainCategories = mainCategoriesResult.data || []
        const subCategories = subCategoriesResult.data || []

                  const formattedAddresses = addressResult.data.map((item) => {
          // Manuel olarak kategori isimlerini bul
          const mainCategory = mainCategories.find(cat => cat.id === item.main_category_id)
          const subCategory = subCategories.find(cat => cat.id === item.sub_category_id)

          return {
            id: item.id,
            latitude: item.latitude,
            longitude: item.longitude,
            firstName: item.first_name,
            lastName: item.last_name,
            gender: item.gender,
            province: item.province,
            district: item.district,
            neighborhood: item.neighborhood,
            address: item.address,
            mainCategoryId: item.main_category_id,
            subCategoryId: item.sub_category_id,
            mainCategoryName: mainCategory?.name,
            subCategoryName: subCategory?.name,
            createdAt: item.created_at,
          }
        })

        setAddresses(formattedAddresses)
      }
    } catch (error) {
      console.error("Adresler yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Adresler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Sayfa yüklendiğinde adresleri getir
  useEffect(() => {
    if (supabase && user) {
      loadAddresses()
    }
  }, [supabase, user])

  // Adres sil
  const deleteAddress = async (id: string) => {
    if (!supabase || !hasPermission("DELETE_ADDRESS")) return

    try {
      const addressToDelete = addresses.find((addr) => addr.id === id)

      const result = await supabase.delete("addresses", { id })

      if (result.error) throw result.error

      await logAction("DELETE_ADDRESS", `Deleted address: ${addressToDelete?.firstName} ${addressToDelete?.lastName}`)

      toast({
        title: "Başarılı",
        description: "Adres başarıyla silindi.",
      })

      // Listeyi ve haritayı güncelle
      loadAddresses()
      refreshMarkers()
    } catch (error) {
      console.error("Adres silinirken hata:", error)
      toast({
        title: "Hata",
        description: "Adres silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Konuma git - improved to show the specific marker
  const goToLocation = (address: Marker) => {
    // Set map center and zoom
    setMapCenter([address.latitude, address.longitude])
    setMapZoom(15)

    // Highlight the specific marker
    setHighlightedMarkerId(address.id)
    setSelectedMarker(address)

    // Log the action
    logAction(
      "VIEW_LOCATION",
      `Viewed location: ${address.firstName} ${address.lastName} at ${address.latitude}, ${address.longitude}`,
    )

    // Navigate to main page
    router.push("/")

    // Clear highlight after navigation
    setTimeout(() => {
      setHighlightedMarkerId(null)
    }, 5000)
  }

  // Optimized search with useMemo to prevent freezing
  const filteredAddresses = useMemo(() => {
    if (!searchTerm.trim()) {
      return addresses
    }

    const searchLower = searchTerm.toLowerCase().trim()
    const searchWords = searchLower.split(/\s+/) // Split by whitespace to handle multiple words

    return addresses.filter((item) => {
      // Create searchable text combining all relevant fields
      const searchableText = [
        item.firstName,
        item.lastName,
        `${item.firstName} ${item.lastName}`, // Full name
        `${item.lastName} ${item.firstName}`, // Reversed name
        item.province,
        item.district,
        item.neighborhood,
        item.address,
        item.mainCategoryName,
        item.subCategoryName,
        item.gender,
      ]
        .filter(Boolean) // Remove null/undefined values
        .join(" ")
        .toLowerCase()

      // Check if all search words are found in the searchable text
      return searchWords.every((word) => searchableText.includes(word))
    })
  }, [addresses, searchTerm])

  return (
    <div className="container py-10 px-4 max-w-7xl mx-auto bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-100">Hizmet Alanların Listesi</h1>

      {/* Arama */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="İsim, soyisim, cinsiyet, il, ilçe, mahalle veya kategori ile arayın..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400"
        />
      </div>

      {/* Sonuç sayısı */}
      {searchTerm && (
        <div className="mb-4 text-sm text-gray-400">
          {filteredAddresses.length} sonuç bulundu
          {searchTerm && ` "${searchTerm}" için`}
        </div>
      )}

      {/* Tablo */}
      <div className="border rounded-md overflow-hidden border-gray-600">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-600">
                <TableHead className="text-gray-200 min-w-[150px]">Ad Soyad</TableHead>
                <TableHead className="text-gray-200 min-w-[80px]">Cinsiyet</TableHead>
                <TableHead className="text-gray-200 min-w-[120px]">İl</TableHead>
                <TableHead className="text-gray-200 min-w-[120px]">İlçe</TableHead>
                <TableHead className="text-gray-200 min-w-[120px]">Mahalle</TableHead>
                <TableHead className="text-gray-200 min-w-[140px]">Risk Faktörü</TableHead>
                <TableHead className="text-gray-200 min-w-[140px]">Hizmet Türü</TableHead>
                <TableHead className="hidden lg:table-cell text-gray-200 min-w-[200px]">Adres</TableHead>
                <TableHead className="text-gray-200 min-w-[100px]">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-gray-600">
                  <TableCell colSpan={9} className="text-center py-8 text-gray-300">
                    Veriler yükleniyor...
                  </TableCell>
                </TableRow>
              ) : filteredAddresses.length === 0 ? (
                <TableRow className="border-gray-600">
                  <TableCell colSpan={9} className="text-center py-8 text-gray-300">
                    {searchTerm ? "Arama kriterlerine uygun kayıt bulunamadı." : "Henüz kayıtlı adres bulunmamaktadır."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAddresses.map((address) => (
                  <TableRow key={address.id} className="border-gray-600 hover:bg-gray-800">
                    <TableCell className="text-gray-200 font-medium">
                      <div className="flex flex-col">
                        <span>
                          {address.firstName} {address.lastName}
                        </span>
                        {/* Show address on mobile */}
                        <span className="text-xs text-gray-400 lg:hidden mt-1">
                          {address.province}, {address.district}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        address.gender === 'Erkek' ? 'bg-blue-900/50 text-blue-300' :
                        address.gender === 'Kadın' ? 'bg-pink-900/50 text-pink-300' :
                        'bg-gray-700/50 text-gray-400'
                      }`}>
                        {address.gender || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-300">{address.province}</TableCell>
                    <TableCell className="text-gray-300">{address.district}</TableCell>
                    <TableCell className="text-gray-300">{address.neighborhood}</TableCell>
                    <TableCell className="text-gray-300">
                      <div className="flex flex-col">
                        <span>{address.mainCategoryName}</span>
                        {/* Show service type on mobile */}
                        <span className="text-xs text-gray-400 lg:hidden mt-1">{address.subCategoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 hidden lg:table-cell">{address.subCategoryName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-gray-300">
                      <div className="flex flex-col">
                        <span className="font-medium">{address.address}</span>
                        <span className="text-gray-400 mt-1">
                          {address.neighborhood}, {address.district}, {address.province}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => goToLocation(address)}
                          title="Haritada Göster"
                          className="text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>

                        {hasPermission("DELETE_ADDRESS") && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Sil"
                                className="text-red-400 hover:text-red-300 hover:bg-gray-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-800 border-gray-600">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-gray-100">Adresi Sil</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-300">
                                  Bu işlem geri alınamaz. Bu adresi silmek istediğinizden emin misiniz?
                                  <br />
                                  <strong className="text-gray-100">
                                    {address.firstName} {address.lastName} - {address.province}, {address.district}
                                  </strong>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600">
                                  İptal
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteAddress(address.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Responsive info */}
      <div className="mt-4 text-xs text-gray-500 lg:hidden">* Adres bilgileri masaüstü görünümünde gösterilir</div>
    </div>
  )
}
