"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/context/supabase-context"
import { useMap } from "@/context/map-context"
import { useAuth } from "@/context/auth-context"
import { Trash2, MapPin, Search, AlertTriangle, Database, ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import type { Marker } from "@/context/map-context"
import { ServiceStatistics } from "@/components/service-statistics"
import { ProfileEditModal } from "@/components/profile-edit-modal"

// Constants for pagination
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]
const DEFAULT_PAGE_SIZE = 50

export default function ServiceListPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { refreshMarkers, setMapCenter, setMapZoom, setHighlightedMarkerId, setSelectedMarker } = useMap()
  const { user, hasPermission, logAction } = useAuth()

  const [addresses, setAddresses] = useState<Marker[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Edit modal state
  const [editingAddress, setEditingAddress] = useState<Marker | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Debounce search term to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

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

      // Ana adres verilerini kategorilerle birlikte çek (joinli sorgu)
      const addressQueryOptions = {
        ...queryOptions,
        select: `
          *,
          main_categories(name, color),
          sub_categories(name, color)
        `,
        limit: 50000 // Fetch up to 50000 records to handle large datasets
      }

      const addressResult = await supabase.select("addresses", addressQueryOptions)

      if (addressResult.error) throw addressResult.error

      if (addressResult.data) {
        const formattedAddresses = addressResult.data.map((item: any) => ({
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
          mainCategoryName: item.main_categories?.name,
          mainCategoryColor: item.main_categories?.color || "#3B82F6",
          subCategoryName: item.sub_categories?.name,
          subCategoryColor: item.sub_categories?.color || "#3B82F6",
          createdAt: item.created_at,
        }))

        console.log(`Loaded ${formattedAddresses.length} addresses from database`)
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

      // Update the list immediately without reloading all data
      setAddresses(prev => prev.filter(addr => addr.id !== id))
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

  // Optimize password input handler to prevent freezing
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAdminPassword(value)
  }, [])

  // Tüm adresleri sil (sadece admin)
  const deleteAllAddresses = async () => {
    if (user?.role !== 'admin' || !user?.id) return

    // UI donmasını önlemek için immediate state update
    setIsDeleting(true)

    try {
      console.log('Admin password verification started...')
      
      // UI güncellemesi için küçük delay
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Önce şifreyi API üzerinden doğrula
      const passwordVerifyResponse = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: adminPassword,
          userId: user.id
        })
      })

      const passwordResult = await passwordVerifyResponse.json()
      console.log('Password verification result:', passwordResult)

      if (!passwordVerifyResponse.ok || !passwordResult.success) {
        toast({
          title: "Hata",
          description: passwordResult.error || "Yanlış şifre! Lütfen doğru sistem şifresini girin.",
          variant: "destructive",
        })
        setIsDeleting(false)
        return
      }

      console.log('Password verified, starting deletion...')
      
      // Şifre doğrulandı, artık verileri silebiliriz - yeni API kullan
      const totalCount = addresses.length
      const deleteResponse = await fetch('/api/admin/delete-all-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      })

      const deleteResult = await deleteResponse.json()
      console.log('Delete result:', deleteResult)

      if (!deleteResponse.ok || !deleteResult.success) {
        throw new Error(deleteResult.error || 'Silme işlemi başarısız')
      }

      console.log('Addresses deleted successfully')

      // Log action
      await logAction("DELETE_ALL_ADDRESSES", `Deleted all addresses in the system. Total count: ${deleteResult.deletedCount || totalCount}`)

      // Success message
      toast({
        title: "Başarılı", 
        description: `Tüm hizmet alan kayıtları (${deleteResult.deletedCount || totalCount} kayıt) başarıyla silindi.`,
      })

      // UI güncellemelerini batch'le - asenkron yap
      setTimeout(() => {
        setAddresses([])
        refreshMarkers()
      }, 50)
      
      // Dialog'u kapat ve form'u temizle
      setIsDeleteAllDialogOpen(false)
      setAdminPassword("")
      
    } catch (error) {
      console.error("Tüm adresler silinirken hata:", error)
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Adresler silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
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

  // Handle edit address
  const handleEditAddress = (address: Marker) => {
    setEditingAddress(address)
    setIsEditModalOpen(true)
    logAction(
      "EDIT_ADDRESS_INITIATED",
      `Started editing address: ${address.firstName} ${address.lastName}`,
    )
  }

  // Optimized search with useMemo to prevent freezing
  const filteredAddresses = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return addresses
    }

    const searchLower = debouncedSearchTerm.toLowerCase().trim()
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
  }, [addresses, debouncedSearchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(filteredAddresses.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPageData = filteredAddresses.slice(startIndex, endIndex)

  // Handle page size change
  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize))
    setCurrentPage(1) // Reset to first page
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return pages
  }

  return (
    <div className="container py-10 px-4 max-w-7xl mx-auto bg-gray-900 min-h-screen pt-20 md:pt-10">
      <h1 className="text-2xl font-bold mb-6 text-gray-100">Hizmet Alanların Listesi</h1>

      {/* İstatistikler */}
      <ServiceStatistics addresses={addresses} isLoading={isLoading} />

      {/* Arama ve Admin Kontrolleri */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="İsim, soyisim, cinsiyet, il, ilçe, mahalle veya kategori ile arayın..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400"
          />
        </div>
        
        {/* Admin kontrolleri - sadece admin kullanıcılar için */}
        {user?.role === 'admin' && (
          <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="shrink-0 bg-red-700 hover:bg-red-800"
                disabled={addresses.length === 0}
              >
                <Database className="h-4 w-4 mr-2" />
                Tüm Verileri Sil
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-600 text-gray-100">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Kritik İşlem: Tüm Hizmet Alan Verilerini Sil
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  ⚠️ <strong>Bu işlem GERİ ALINMAZ!</strong>
                  <br />
                  <br />
                  Sistemdeki <strong className="text-red-400">{addresses.length} adet</strong> hizmet alan kaydının 
                  <strong className="text-red-400"> tamamı kalıcı olarak silinecektir.</strong>
                  <br />
                  <br />
                  Devam etmek için sistem yöneticisi şifrenizi girin:
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-gray-200">
                    Sistem Yöneticisi Şifresi
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={handlePasswordChange}
                    placeholder="Şifrenizi girin..."
                    className="bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    disabled={isDeleting}
                    autoComplete="current-password"
                    maxLength={50}
                  />
                </div>
                
                <div className="p-3 bg-red-900/20 border border-red-700 rounded-md">
                  <p className="text-sm text-red-300">
                    <strong>Uyarı:</strong> Bu işlem şunları silecektir:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-300 mt-2 space-y-1">
                    <li>Tüm kişi bilgileri ve adresleri</li>
                    <li>Tüm konum koordinatları</li>
                    <li>Tüm kategori atamaları</li>
                    <li>Haritadaki tüm işaretleyiciler</li>
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsDeleteAllDialogOpen(false)
                    setAdminPassword("")
                  }}
                  disabled={isDeleting}
                  className="bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600"
                >
                  İptal
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteAllAddresses}
                  disabled={!adminPassword.trim() || isDeleting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Evet, Tüm Verileri Sil
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sonuç sayısı ve sayfalama kontrolleri */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="text-sm text-gray-400">
          {filteredAddresses.length} sonuç bulundu
          {debouncedSearchTerm && ` "${debouncedSearchTerm}" için`}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sayfa başına:</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20 h-8 bg-gray-800 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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
              ) : currentPageData.length === 0 ? (
                <TableRow className="border-gray-600">
                  <TableCell colSpan={9} className="text-center py-8 text-gray-300">
                    {debouncedSearchTerm ? "Arama kriterlerine uygun kayıt bulunamadı." : "Henüz kayıtlı adres bulunmamaktadır."}
                  </TableCell>
                </TableRow>
              ) : (
                currentPageData.map((address) => (
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
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                          style={{ 
                            backgroundColor: address.mainCategoryColor || "#3B82F6",
                            boxShadow: `0 1px 3px ${address.mainCategoryColor || "#3B82F6"}30`
                          }}
                        >
                          {/* Mini parıltı efekti */}
                          <div 
                            className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                          />
                        </div>
                        <span>{address.mainCategoryName}</span>
                      </div>
                        {/* Show service type on mobile */}
                        <div className="flex items-center gap-1 lg:hidden mt-1">
                          <div
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{ backgroundColor: address.subCategoryColor || "#3B82F6" }}
                          />
                          <span className="text-xs text-gray-400">{address.subCategoryName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                          style={{ 
                            backgroundColor: address.subCategoryColor || "#3B82F6",
                            boxShadow: `0 1px 3px ${address.subCategoryColor || "#3B82F6"}30`
                          }}
                        >
                          {/* Mini parıltı efekti */}
                          <div 
                            className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                          />
                        </div>
                        <span>{address.subCategoryName}</span>
                      </div>
                    </TableCell>
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

                        {user?.role === 'admin' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditAddress(address)}
                            title="Düzenle"
                            className="text-green-400 hover:text-green-300 hover:bg-gray-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

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

      {/* Pagination Controls */}
      {!isLoading && filteredAddresses.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-400">
            Gösterilen: {startIndex + 1}-{Math.min(endIndex, filteredAddresses.length)} / {filteredAddresses.length}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="bg-gray-800 border-gray-600 hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {currentPage > 3 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  className="bg-gray-800 border-gray-600 hover:bg-gray-700 hidden sm:inline-flex"
                >
                  1
                </Button>
                {currentPage > 4 && <span className="text-gray-500 hidden sm:inline">...</span>}
              </>
            )}
            
            {getPageNumbers().map(page => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={page === currentPage 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                }
              >
                {page}
              </Button>
            ))}
            
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="text-gray-500 hidden sm:inline">...</span>}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  className="bg-gray-800 border-gray-600 hover:bg-gray-700 hidden sm:inline-flex"
                >
                  {totalPages}
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-800 border-gray-600 hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Responsive info */}
      <div className="mt-4 text-xs text-gray-500 lg:hidden">* Adres bilgileri masaüstü görünümünde gösterilir</div>

      {/* Edit Modal */}
      {editingAddress && (
        <ProfileEditModal
          marker={editingAddress}
          isOpen={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open)
            if (!open) {
              setEditingAddress(null)
              // Refresh the addresses list after editing
              loadAddresses()
            }
          }}
        />
      )}
    </div>
  )
}