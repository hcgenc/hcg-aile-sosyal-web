"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import { useSupabase } from "@/context/supabase-context"
import { useAuth } from "@/context/auth-context"
import { PlusCircle, Trash2, Edit, Check, X, Palette, ChevronDown, FolderTree, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MainCategory, SubCategory } from "@/types/categories"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

// 24 tamamen farklı renk - birbirine hiç benzemeyen
const COLOR_PALETTE = [
  "#FF0000", // Kırmızı
  "#FF8C00", // Turuncu
  "#FFFF00", // Sarı  
  "#32CD32", // Yeşil
  "#00FFFF", // Cyan
  "#0000FF", // Mavi
  "#8A2BE2", // Mor
  "#FF00FF", // Magenta
  "#FFC0CB", // Pembe
  "#8B4513", // Kahverengi
  "#808080", // Gri
  "#000000", // Siyah
  "#FFFFFF", // Beyaz
  "#FFD700", // Altın
  "#4B0082", // İndigo
  "#DC143C", // Crimson
  "#00FF00", // Lime
  "#FF1493", // Deep Pink
  "#2F4F4F", // Dark Slate Gray
  "#FF6347", // Tomato
  "#7FFF00", // Chartreuse
  "#20B2AA", // Light Sea Green
  "#9370DB", // Medium Orchid
  "#D2691E"  // Chocolate
]

export default function CategoryManagementPage() {
  const { supabase } = useSupabase()
  const { logAction, hasPermission } = useAuth()

  // Ana kategoriler
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [newMainCategoryName, setNewMainCategoryName] = useState("")
  const [newMainCategoryColor, setNewMainCategoryColor] = useState("#3B82F6")
  const [editMainCategoryId, setEditMainCategoryId] = useState<string | null>(null)
  const [editMainCategoryName, setEditMainCategoryName] = useState("")
  const [editMainCategoryColor, setEditMainCategoryColor] = useState("#3B82F6")

  // Alt kategoriler
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [newSubCategoryName, setNewSubCategoryName] = useState("")
  const [newSubCategoryColor, setNewSubCategoryColor] = useState("#3B82F6")
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null)
  const [editSubCategoryId, setEditSubCategoryId] = useState<string | null>(null)
  const [editSubCategoryName, setEditSubCategoryName] = useState("")
  const [editSubCategoryColor, setEditSubCategoryColor] = useState("#3B82F6")

  // Renk tonları oluşturma fonksiyonu
  const generateColorTones = useCallback((baseColor: string): string[] => {
    // Hex rengi RGB'ye çevir
    const r = parseInt(baseColor.slice(1, 3), 16)
    const g = parseInt(baseColor.slice(3, 5), 16)
    const b = parseInt(baseColor.slice(5, 7), 16)
    
    const tones: string[] = []
    
    // Orijinal renk
    tones.push(baseColor)
    
    // Açık tonlar (beyaza doğru)
    for (let i = 1; i <= 3; i++) {
      const factor = i * 0.2
      const newR = Math.round(r + (255 - r) * factor)
      const newG = Math.round(g + (255 - g) * factor)
      const newB = Math.round(b + (255 - b) * factor)
      tones.push(`#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`)
    }
    
    // Koyu tonlar (siyaha doğru)
    for (let i = 1; i <= 8; i++) {
      const factor = i * 0.1
      const newR = Math.round(r * (1 - factor))
      const newG = Math.round(g * (1 - factor))
      const newB = Math.round(b * (1 - factor))
      tones.push(`#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`)
    }
    
    return tones
  }, [])

  // Ana kategorileri yükle
  const loadMainCategories = useCallback(async () => {
    if (!supabase) return

    try {
      const result = await supabase.select("main_categories", {
        select: "*",
        orderBy: { column: "name", ascending: true }
      })

      if (result.error) throw result.error

      if (result.data && result.data.length >= 0) {
        setMainCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            color: item.color || "#3B82F6",
          })),
        )
      }
    } catch (error) {
      console.error("Ana kategoriler yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Kategoriler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase])

  // Alt kategorileri yükle
  const loadSubCategories = useCallback(async () => {
    if (!supabase) return

    try {
      const queryOptions: any = {
        select: `
          *,
          main_categories(name, color)
        `,
        orderBy: { column: "name", ascending: true }
      }

      if (selectedMainCategoryId) {
        queryOptions.filter = { main_category_id: selectedMainCategoryId }
      }

      const result = await supabase.select("sub_categories", queryOptions)

      if (result.error) throw result.error

      if (result.data && result.data.length >= 0) {
        setSubCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
            color: item.color || "#3B82F6",
          })),
        )
      }
    } catch (error) {
      console.error("Alt kategoriler yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Alt kategoriler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, selectedMainCategoryId])

  // Sayfa yüklendiğinde kategorileri getir
  useEffect(() => {
    if (supabase) {
      loadMainCategories()
    }
  }, [loadMainCategories])

  // Seçili ana kategori değiştiğinde alt kategorileri yükle
  useEffect(() => {
    if (supabase) {
      loadSubCategories()
    }
  }, [loadSubCategories])

  // Ana kategori ekle
  const addMainCategory = useCallback(async () => {
    if (!supabase || !newMainCategoryName.trim()) return

    // Permission kontrolü
    if (!hasPermission("MANAGE_CATEGORIES")) {
      toast({
        title: "Yetkisiz İşlem",
        description: "Kategori yönetimi için yetkiniz bulunmuyor.",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await supabase.insert("main_categories", {
        name: newMainCategoryName.trim(),
        color: newMainCategoryColor
      })

      if (result.error) throw result.error

      await logAction("ADD_MAIN_CATEGORY", `Added main category: ${newMainCategoryName.trim()} with color: ${newMainCategoryColor}`)

      toast({
        title: "Başarılı",
        description: "Risk faktörü başarıyla eklendi.",
      })

      setNewMainCategoryName("")
      setNewMainCategoryColor("#3B82F6")
      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori eklenirken hata:", error)
      console.error("Error details:", error instanceof Error ? error.message : JSON.stringify(error))
      
      // Parse error message if it comes from Supabase
      let errorMessage = "Risk faktörü eklenirken bir sorun oluştu."
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as any).message || errorMessage
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      toast({
        title: "Hata",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [supabase, newMainCategoryName, newMainCategoryColor, logAction, loadMainCategories])

  // Ana kategori düzenle
  const updateMainCategory = useCallback(async () => {
    if (!supabase || !editMainCategoryId || !editMainCategoryName.trim()) return

    // Permission kontrolü
    if (!hasPermission("MANAGE_CATEGORIES")) {
      toast({
        title: "Yetkisiz İşlem",
        description: "Kategori yönetimi için yetkiniz bulunmuyor.",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await supabase.update("main_categories", 
        { 
          name: editMainCategoryName.trim(),
          color: editMainCategoryColor
        },
        { id: editMainCategoryId }
      )

      if (result.error) throw result.error

      await logAction("UPDATE_MAIN_CATEGORY", `Updated main category: ${editMainCategoryName.trim()} with color: ${editMainCategoryColor}`)

      toast({
        title: "Başarılı",
        description: "Risk faktörü başarıyla güncellendi.",
      })

      setEditMainCategoryId(null)
      setEditMainCategoryName("")
      setEditMainCategoryColor("#3B82F6")
      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori güncellenirken hata:", error)
      console.error("Error details:", error instanceof Error ? error.message : JSON.stringify(error))
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Risk faktörü güncellenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, editMainCategoryId, editMainCategoryName, editMainCategoryColor, logAction, loadMainCategories])

  // Ana kategoriyi düzenleme moduna al
  const startEditingMainCategory = useCallback((category: MainCategory) => {
    setEditMainCategoryId(category.id)
    setEditMainCategoryName(category.name)
    setEditMainCategoryColor(category.color || "#3B82F6")
  }, [])

  // Ana kategori silme
  const deleteMainCategory = useCallback(async (id: string) => {
    if (!supabase) return

    try {
      // Önce bu ana kategoriye ait alt kategorileri kontrol et
      const subCatsResult = await supabase.select("sub_categories", {
        select: "id",
        filter: { main_category_id: id }
      })

      if (subCatsResult.error) throw subCatsResult.error

      if (subCatsResult.data && subCatsResult.data.length > 0) {
        toast({
          title: "Uyarı",
          description: "Bu kategoriye ait alt kategoriler bulunmaktadır. Önce bunları silmeniz gerekiyor.",
          variant: "destructive",
        })
        return
      }

      // Sonra bu ana kategoriye ait adresler var mı kontrol et
      const addressesResult = await supabase.select("addresses", {
        select: "id",
        filter: { main_category_id: id }
      })

      if (addressesResult.error) throw addressesResult.error

      if (addressesResult.data && addressesResult.data.length > 0) {
        toast({
          title: "Uyarı",
          description: "Bu kategoriye ait adresler bulunmaktadır. Önce bunları silmeniz veya güncellenmeniz gerekiyor.",
          variant: "destructive",
        })
        return
      }

      // Kategoriyi sil
      const result = await supabase.delete("main_categories", { id })

      if (result.error) throw result.error

      await logAction("DELETE_MAIN_CATEGORY", `Deleted main category with ID: ${id}`)

      toast({
        title: "Başarılı",
        description: "Risk faktörü başarıyla silindi.",
      })

      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori silinirken hata:", error)
      toast({
        title: "Hata",
        description: "Risk faktörü silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, logAction, loadMainCategories])

  // Ana kategori seçildiğinde alt kategori rengini güncelle
  useEffect(() => {
    if (selectedMainCategoryId) {
      const selectedCategory = mainCategories.find(cat => cat.id === selectedMainCategoryId)
      if (selectedCategory) {
        setNewSubCategoryColor(selectedCategory.color)
      }
    }
  }, [selectedMainCategoryId, mainCategories])

  // Alt kategori ekle
  const addSubCategory = useCallback(async () => {
    if (!supabase || !selectedMainCategoryId || !newSubCategoryName.trim()) return

    try {
      const result = await supabase.insert("sub_categories", {
        name: newSubCategoryName.trim(),
        main_category_id: selectedMainCategoryId,
        color: newSubCategoryColor,
      })

      if (result.error) throw result.error

      await logAction(
        "ADD_SUB_CATEGORY",
        `Added sub category: ${newSubCategoryName.trim()} with color: ${newSubCategoryColor} to main category ${selectedMainCategoryId}`,
      )

      toast({
        title: "Başarılı",
        description: "Hizmet türü başarıyla eklendi.",
      })

      setNewSubCategoryName("")
      const selectedCategory = mainCategories.find(cat => cat.id === selectedMainCategoryId)
      setNewSubCategoryColor(selectedCategory?.color || "#3B82F6")
      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori eklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Hizmet türü eklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, selectedMainCategoryId, newSubCategoryName, newSubCategoryColor, logAction, loadSubCategories, mainCategories])

  // Alt kategori düzenle
  const updateSubCategory = useCallback(async () => {
    if (!supabase || !editSubCategoryId || !editSubCategoryName.trim()) return

    try {
      const result = await supabase.update("sub_categories",
        { 
          name: editSubCategoryName.trim(),
          color: editSubCategoryColor
        },
        { id: editSubCategoryId }
      )

      if (result.error) throw result.error

      await logAction("UPDATE_SUB_CATEGORY", `Updated sub category: ${editSubCategoryName.trim()} with color: ${editSubCategoryColor}`)

      toast({
        title: "Başarılı",
        description: "Hizmet türü başarıyla güncellendi.",
      })

      setEditSubCategoryId(null)
      setEditSubCategoryName("")
      setEditSubCategoryColor("#3B82F6")
      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori güncellenirken hata:", error)
      toast({
        title: "Hata",
        description: "Hizmet türü güncellenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, editSubCategoryId, editSubCategoryName, editSubCategoryColor, logAction, loadSubCategories])

  // Alt kategori sil
  const deleteSubCategory = useCallback(async (id: string) => {
    if (!supabase) return

    try {
      // Önce bu alt kategoriye ait adresler var mı kontrol et
      const addressesResult = await supabase.select("addresses", {
        select: "id",
        filter: { sub_category_id: id }
      })

      if (addressesResult.error) throw addressesResult.error

      if (addressesResult.data && addressesResult.data.length > 0) {
        toast({
          title: "Uyarı",
          description:
            "Bu hizmet türüne ait adresler bulunmaktadır. Önce bunları silmeniz veya güncellenmeniz gerekiyor.",
          variant: "destructive",
        })
        return
      }

      // Alt kategoriyi sil
      const result = await supabase.delete("sub_categories", { id })

      if (result.error) throw result.error

      await logAction("DELETE_SUB_CATEGORY", `Deleted sub category with ID: ${id}`)

      toast({
        title: "Başarılı",
        description: "Hizmet türü başarıyla silindi.",
      })

      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori silinirken hata:", error)
      toast({
        title: "Hata",
        description: "Hizmet türü silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }, [supabase, logAction, loadSubCategories])

  // Renk paleti bileşeni
  const ColorPaletteButton = ({ 
    selectedColor, 
    onColorSelect, 
    size = "default",
    className = ""
  }: { 
    selectedColor: string, 
    onColorSelect: (color: string) => void,
    size?: "default" | "small",
    className?: string
  }) => {
    const buttonSize = size === "small" ? "w-8 h-8" : "w-10 h-10"
    const iconSize = size === "small" ? "h-4 w-4" : "h-5 w-5"
    const hasColorSelected = selectedColor !== "#3B82F6" // Varsayılan renkten farklı bir renk seçildi mi?
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={hasColorSelected ? "default" : "outline"}
            className={`${buttonSize} p-2 flex items-center justify-center hover:scale-105 transition-all duration-200 relative ${
              hasColorSelected 
                ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md' 
                : 'hover:border-gray-400'
            } ${className}`}
            title="Renk seç"
          >
            <Palette 
              className={`${iconSize} ${
                hasColorSelected 
                  ? 'text-white' 
                  : selectedColor !== "#3B82F6" 
                    ? 'text-gray-600 dark:text-gray-400' 
                    : 'text-gray-500'
              }`}
              style={{ 
                color: hasColorSelected ? 'white' : (selectedColor !== "#3B82F6" ? selectedColor : undefined)
              }}
            />
            {hasColorSelected && (
              <div 
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: selectedColor }}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-4" align="end">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Renk Seçin</h4>
            <p className="text-xs text-gray-500">24 farklı renk seçeneği</p>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {COLOR_PALETTE.map((color, index) => (
              <button
                key={index}
                className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 hover:shadow-md ${
                  selectedColor === color 
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' 
                    : color === "#FFFFFF" 
                      ? 'border-gray-400 dark:border-gray-500 hover:border-gray-600 dark:hover:border-gray-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => onColorSelect(color)}
                title={`Renk: ${color}`}
              />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div 
                className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="font-mono text-xs">{selectedColor}</span>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Ton paleti bileşeni - sadece hizmet türleri için
  const TonePaletteButton = ({ 
    selectedColor, 
    onColorSelect, 
    baseColor,
    size = "default" 
  }: { 
    selectedColor: string, 
    onColorSelect: (color: string) => void,
    baseColor: string,
    size?: "default" | "small"
  }) => {
    const buttonSize = size === "small" ? "w-8 h-8" : "w-10 h-10"
    const iconSize = size === "small" ? "h-4 w-4" : "h-5 w-5"
    const tones = generateColorTones(baseColor)
    const hasColorSelected = selectedColor !== baseColor // Varsayılan renkten farklı bir renk seçildi mi?
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={hasColorSelected ? "default" : "outline"}
            className={`${buttonSize} p-2 flex items-center justify-center hover:scale-105 transition-all duration-200 relative ${
              hasColorSelected 
                ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md' 
                : 'hover:border-gray-400'
            }`}
            title="Renk tonu seç"
          >
            <Palette 
              className={`${iconSize} ${
                hasColorSelected 
                  ? 'text-white' 
                  : selectedColor !== "#3B82F6" 
                    ? 'text-gray-600 dark:text-gray-400' 
                    : 'text-gray-500'
              }`}
              style={{ 
                color: hasColorSelected ? 'white' : (selectedColor !== "#3B82F6" ? selectedColor : undefined)
              }}
            />
            {hasColorSelected && (
              <div 
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: selectedColor }}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 p-4" align="end">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Renk Tonu Seçin</h4>
            <p className="text-xs text-gray-500">{tones.length} farklı ton seçeneği</p>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {tones.map((color, index) => (
              <button
                key={index}
                className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 hover:shadow-md ${
                  selectedColor === color 
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' 
                    : color === "#FFFFFF" 
                      ? 'border-gray-400 dark:border-gray-500 hover:border-gray-600 dark:hover:border-gray-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => onColorSelect(color)}
                title={`Renk: ${color}`}
              />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div 
                className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="font-mono text-xs">{selectedColor}</span>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="container py-10 px-4 max-w-6xl mx-auto pt-20 md:pt-10">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FolderTree className="h-6 w-6" />
        Kategori Yönetimi
      </h1>

      <Tabs defaultValue="main">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="main">Risk Faktörleri</TabsTrigger>
          <TabsTrigger value="sub">Hizmet Türleri</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-6">
          {/* Ana Kategori Ekleme - Sadece Admin Kullanıcılar İçin */}
          {hasPermission("MANAGE_CATEGORIES") && (
            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <Label className="text-base font-semibold mb-4 block">Yeni Risk Faktörü Ekle</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="newMainCategory" className="mb-2 block text-sm">
                    Risk Faktörü Adı
                  </Label>
                  <Input
                    id="newMainCategory"
                    value={newMainCategoryName}
                    onChange={(e) => setNewMainCategoryName(e.target.value)}
                    placeholder="Risk faktörü adı girin"
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-sm">Renk</Label>
                  <ColorPaletteButton 
                    selectedColor={newMainCategoryColor}
                    onColorSelect={setNewMainCategoryColor}
                  />
                </div>
                <Button 
                  onClick={addMainCategory} 
                  disabled={!newMainCategoryName.trim()}
                  className="px-6"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Risk faktörü adını yazın ve palet ikonuna tıklayarak renk seçin.</p>
            </div>
          )}

          {/* Editor kullanıcıları için bilgilendirme mesajı */}
          {!hasPermission("MANAGE_CATEGORIES") && (
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <AlertTriangle className="h-5 w-5" />
                <Label className="text-base font-semibold">Sadece Görüntüleme</Label>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                Risk faktörlerini görüntüleyebilirsiniz ancak ekleme, düzenleme veya silme işlemi yapamazsınız.
              </p>
            </div>
          )}

          {/* Ana Kategoriler Listesi */}
          <div className="border rounded-md">
            <div className="grid grid-cols-[50px,1fr,auto] p-4 font-medium border-b bg-gray-50 dark:bg-gray-800">
              <div>Renk</div>
              <div>Risk Faktörü Adı</div>
              <div>İşlemler</div>
            </div>

            {mainCategories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Palette className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Henüz risk faktörü bulunmuyor</p>
                <p>Yukarıdan yeni bir risk faktörü ve rengi ekleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="divide-y">
                {mainCategories.map((category) => (
                  <div key={category.id} className="grid grid-cols-[50px,1fr,auto] p-4 items-center">
                    {editMainCategoryId === category.id ? (
                      <>
                        <div className="flex items-center">
                          <ColorPaletteButton 
                            selectedColor={editMainCategoryColor}
                            onColorSelect={setEditMainCategoryColor}
                            size="small"
                          />
                        </div>
                        <div>
                          <Input
                            value={editMainCategoryName}
                            onChange={(e) => setEditMainCategoryName(e.target.value)}
                            placeholder="Risk faktörü adı"
                            className="max-w-md"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={updateMainCategory}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditMainCategoryId(null)
                              setEditMainCategoryName("")
                              setEditMainCategoryColor("#3B82F6")
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center">
                          <div
                            className="w-7 h-7 rounded-full shadow-md hover:scale-105 transition-transform duration-200 relative overflow-hidden group"
                            style={{ 
                              backgroundColor: category.color,
                              boxShadow: `0 3px 8px ${category.color}40, 0 1px 3px rgba(0,0,0,0.1)`
                            }}
                            title={`Renk: ${category.color}`}
                          >
                            {/* İç parıltı efekti */}
                            <div 
                              className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent opacity-60"
                            />
                            {/* Hover efekti */}
                            <div 
                              className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            />
                          </div>
                        </div>
                        <div className="font-medium">{category.name}</div>
                        <div className="flex gap-2">
                          {hasPermission("MANAGE_CATEGORIES") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingMainCategory(category)}
                                title="Düzenle"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" title="Sil">
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Risk Faktörünü Sil</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bu işlem geri alınamaz. "{category.name}" risk faktörünü silmek istediğinizden emin misiniz?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMainCategory(category.id)}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      Sil
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sub" className="space-y-6">
          {/* Ana Kategori Seçimi ve Alt Kategori Ekleme */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="mainCategorySelect" className="mb-2 block">
                Risk Faktörü Seçin
              </Label>
              <Select value={selectedMainCategoryId || undefined} onValueChange={setSelectedMainCategoryId}>
                <SelectTrigger id="mainCategorySelect">
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

            {/* Hizmet Türü Ekleme - Sadece Admin Kullanıcılar İçin */}
            {hasPermission("MANAGE_CATEGORIES") && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="newSubCategory" className="mb-2 block">
                    Yeni Hizmet Türü Ekle
                  </Label>
                  <Input
                    id="newSubCategory"
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                    placeholder="Hizmet türü adı"
                    disabled={!selectedMainCategoryId}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-sm">Renk</Label>
                  {selectedMainCategoryId ? (
                    <TonePaletteButton 
                      selectedColor={newSubCategoryColor}
                      onColorSelect={setNewSubCategoryColor}
                      baseColor={mainCategories.find(cat => cat.id === selectedMainCategoryId)?.color || "#3B82F6"}
                    />
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-10 h-10 p-2 flex items-center justify-center opacity-50 cursor-not-allowed"
                      disabled
                      title="Önce risk faktörü seçin"
                    >
                      <Palette className="h-5 w-5 text-gray-400" />
                    </Button>
                  )}
                </div>
                <Button onClick={addSubCategory} disabled={!selectedMainCategoryId || !newSubCategoryName.trim()}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              </div>
            )}

            {/* Editor kullanıcıları için bilgilendirme mesajı */}
            {!hasPermission("MANAGE_CATEGORIES") && (
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <AlertTriangle className="h-5 w-5" />
                  <Label className="text-base font-semibold">Sadece Görüntüleme</Label>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                  Hizmet türlerini görüntüleyebilirsiniz ancak ekleme, düzenleme veya silme işlemi yapamazsınız.
                </p>
              </div>
            )}
          </div>

          {/* Alt Kategoriler Listesi */}
          <div className="border rounded-md">
            <div className="grid grid-cols-[50px,1fr,1fr,auto] p-4 font-medium border-b bg-gray-50 dark:bg-gray-800">
              <div>Renk</div>
              <div>Hizmet Türü Adı</div>
              <div>Risk Faktörü</div>
              <div>İşlemler</div>
            </div>

            {subCategories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {selectedMainCategoryId ? (
                  <>
                    <p className="text-lg font-medium mb-2">Bu risk faktörüne ait hizmet türü bulunmuyor</p>
                    <p>Yukarıdan yeni bir hizmet türü ekleyebilirsiniz.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">Hizmet türü görüntülemek için</p>
                    <p>Lütfen önce bir risk faktörü seçin.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {subCategories.map((category) => {
                  const mainCategory = mainCategories.find((m) => m.id === category.mainCategoryId)

                  return (
                    <div key={category.id} className="grid grid-cols-[50px,1fr,1fr,auto] p-4 items-center">
                      {editSubCategoryId === category.id ? (
                        <>
                          <div className="flex items-center">
                            <TonePaletteButton 
                              selectedColor={editSubCategoryColor}
                              onColorSelect={setEditSubCategoryColor}
                              baseColor={mainCategory?.color || "#3B82F6"}
                              size="small"
                            />
                          </div>
                          <div>
                            <Input
                              value={editSubCategoryName}
                              onChange={(e) => setEditSubCategoryName(e.target.value)}
                              placeholder="Hizmet türü adı"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full shadow-md relative overflow-hidden"
                              style={{ 
                                backgroundColor: mainCategory?.color,
                                boxShadow: `0 2px 6px ${mainCategory?.color || '#000'}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                              />
                            </div>
                            <span>{mainCategory?.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={updateSubCategory}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditSubCategoryId(null)
                                setEditSubCategoryName("")
                                setEditSubCategoryColor("#3B82F6")
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div
                              className="w-7 h-7 rounded-full shadow-md hover:scale-105 transition-transform duration-200 relative overflow-hidden group"
                              style={{ 
                                backgroundColor: category.color,
                                boxShadow: `0 3px 8px ${category.color}40, 0 1px 3px rgba(0,0,0,0.1)`
                              }}
                              title={`Renk: ${category.color}`}
                            >
                              {/* İç parıltı efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent opacity-60"
                              />
                              {/* Hover efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              />
                            </div>
                          </div>
                          <div className="font-medium">{category.name}</div>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full shadow-md relative overflow-hidden"
                              style={{ 
                                backgroundColor: mainCategory?.color,
                                boxShadow: `0 2px 6px ${mainCategory?.color || '#000'}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                              />
                            </div>
                            <span>{mainCategory?.name}</span>
                          </div>
                          <div className="flex gap-2">
                            {hasPermission("MANAGE_CATEGORIES") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditSubCategoryId(category.id)
                                    setEditSubCategoryName(category.name)
                                    setEditSubCategoryColor(category.color || "#3B82F6")
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hizmet Türünü Sil</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bu işlem geri alınamaz. "{category.name}" hizmet türünü silmek istediğinizden emin misiniz?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>İptal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteSubCategory(category.id)}
                                        className="bg-red-500 hover:bg-red-600"
                                      >
                                        Sil
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
