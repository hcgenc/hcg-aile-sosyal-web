"use client"

import { useState, useEffect } from "react"
import { useSupabase } from "@/context/supabase-context"
import { useAuth } from "@/context/auth-context"
import { PlusCircle, Trash2, Edit, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MainCategory, SubCategory } from "@/types/categories"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

export default function CategoryManagementPage() {
  const { supabase } = useSupabase()
  const { logAction } = useAuth()

  // Ana kategoriler
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [newMainCategoryName, setNewMainCategoryName] = useState("")
  const [editMainCategoryId, setEditMainCategoryId] = useState<string | null>(null)
  const [editMainCategoryName, setEditMainCategoryName] = useState("")

  // Alt kategoriler
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [newSubCategoryName, setNewSubCategoryName] = useState("")
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null)
  const [editSubCategoryId, setEditSubCategoryId] = useState<string | null>(null)
  const [editSubCategoryName, setEditSubCategoryName] = useState("")

  // Ana kategorileri yükle
  const loadMainCategories = async () => {
    if (!supabase) return

    try {
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
    } catch (error) {
      console.error("Ana kategoriler yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Kategoriler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Alt kategorileri yükle
  const loadSubCategories = async () => {
    if (!supabase) return

    try {
      const queryOptions: any = {
        select: `
          *,
          main_categories(name)
        `,
        orderBy: { column: "name", ascending: true }
      }

      if (selectedMainCategoryId) {
        queryOptions.filter = { main_category_id: selectedMainCategoryId }
      }

      const result = await supabase.select("sub_categories", queryOptions)

      if (result.error) throw result.error

      if (result.data) {
        setSubCategories(
          result.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
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
  }

  // Sayfa yüklendiğinde kategorileri getir
  useEffect(() => {
    if (supabase) {
      loadMainCategories()
    }
  }, [supabase])

  // Seçili ana kategori değiştiğinde alt kategorileri yükle
  useEffect(() => {
    if (supabase) {
      loadSubCategories()
    }
  }, [supabase, selectedMainCategoryId])

  // Ana kategori ekle
  const addMainCategory = async () => {
    if (!supabase || !newMainCategoryName.trim()) return

    try {
      const result = await supabase.insert("main_categories", {
        name: newMainCategoryName.trim()
      })

      if (result.error) throw result.error

      await logAction("ADD_MAIN_CATEGORY", `Added main category: ${newMainCategoryName.trim()}`)

      toast({
        title: "Başarılı",
        description: "Ana kategori başarıyla eklendi.",
      })

      setNewMainCategoryName("")
      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori eklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Ana kategori eklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Ana kategori düzenle
  const updateMainCategory = async () => {
    if (!supabase || !editMainCategoryId || !editMainCategoryName.trim()) return

    try {
      const result = await supabase.update("main_categories", 
        { name: editMainCategoryName.trim() },
        { id: editMainCategoryId }
      )

      if (result.error) throw result.error

      await logAction("UPDATE_MAIN_CATEGORY", `Updated main category: ${editMainCategoryName.trim()}`)

      toast({
        title: "Başarılı",
        description: "Ana kategori başarıyla güncellendi.",
      })

      setEditMainCategoryId(null)
      setEditMainCategoryName("")
      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori güncellenirken hata:", error)
      toast({
        title: "Hata",
        description: "Ana kategori güncellenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Ana kategori sil
  const deleteMainCategory = async (id: string) => {
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
        description: "Ana kategori başarıyla silindi.",
      })

      loadMainCategories()
    } catch (error) {
      console.error("Ana kategori silinirken hata:", error)
      toast({
        title: "Hata",
        description: "Ana kategori silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Alt kategori ekle
  const addSubCategory = async () => {
    if (!supabase || !selectedMainCategoryId || !newSubCategoryName.trim()) return

    try {
      const result = await supabase.insert("sub_categories", {
        name: newSubCategoryName.trim(),
        main_category_id: selectedMainCategoryId,
      })

      if (result.error) throw result.error

      await logAction(
        "ADD_SUB_CATEGORY",
        `Added sub category: ${newSubCategoryName.trim()} to main category ${selectedMainCategoryId}`,
      )

      toast({
        title: "Başarılı",
        description: "Alt kategori başarıyla eklendi.",
      })

      setNewSubCategoryName("")
      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori eklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Alt kategori eklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Alt kategori düzenle
  const updateSubCategory = async () => {
    if (!supabase || !editSubCategoryId || !editSubCategoryName.trim()) return

    try {
      const result = await supabase.update("sub_categories",
        { name: editSubCategoryName.trim() },
        { id: editSubCategoryId }
      )

      if (result.error) throw result.error

      await logAction("UPDATE_SUB_CATEGORY", `Updated sub category: ${editSubCategoryName.trim()}`)

      toast({
        title: "Başarılı",
        description: "Alt kategori başarıyla güncellendi.",
      })

      setEditSubCategoryId(null)
      setEditSubCategoryName("")
      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori güncellenirken hata:", error)
      toast({
        title: "Hata",
        description: "Alt kategori güncellenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Alt kategori sil
  const deleteSubCategory = async (id: string) => {
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
            "Bu alt kategoriye ait adresler bulunmaktadır. Önce bunları silmeniz veya güncellenmeniz gerekiyor.",
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
        description: "Alt kategori başarıyla silindi.",
      })

      loadSubCategories()
    } catch (error) {
      console.error("Alt kategori silinirken hata:", error)
      toast({
        title: "Hata",
        description: "Alt kategori silinirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container py-10 px-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Kategori Yönetimi</h1>

      <Tabs defaultValue="main">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="main">Risk Faktörleri</TabsTrigger>
          <TabsTrigger value="sub">Hizmet Türleri</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-6">
          {/* Ana Kategori Ekleme */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="newMainCategory" className="mb-2 block">
                Yeni Risk Faktörü Ekle
              </Label>
              <Input
                id="newMainCategory"
                value={newMainCategoryName}
                onChange={(e) => setNewMainCategoryName(e.target.value)}
                placeholder="Risk faktörü adı"
              />
            </div>
            <Button onClick={addMainCategory} disabled={!newMainCategoryName.trim()}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Ekle
            </Button>
          </div>

          {/* Ana Kategoriler Listesi */}
          <div className="border rounded-md">
            <div className="grid grid-cols-[1fr,auto] p-4 font-medium border-b">
              <div>Risk Faktörü Adı</div>
              <div>İşlemler</div>
            </div>

            {mainCategories.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Henüz risk faktörü bulunmamaktadır. Yukarıdan yeni bir risk faktörü ekleyebilirsiniz.
              </div>
            ) : (
              <div className="divide-y">
                {mainCategories.map((category) => (
                  <div key={category.id} className="grid grid-cols-[1fr,auto] p-4 items-center">
                    {editMainCategoryId === category.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editMainCategoryName}
                          onChange={(e) => setEditMainCategoryName(e.target.value)}
                          placeholder="Risk faktörü adı"
                        />
                        <Button size="sm" variant="ghost" onClick={updateMainCategory}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditMainCategoryId(null)
                            setEditMainCategoryName("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>{category.name}</div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditMainCategoryId(category.id)
                          setEditMainCategoryName(category.name)
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
                            <AlertDialogTitle>Kategoriyi Sil</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bu işlem geri alınamaz. Bu risk faktörünü silmek istediğinizden emin misiniz?
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
                    </div>
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
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Button onClick={addSubCategory} disabled={!selectedMainCategoryId || !newSubCategoryName.trim()}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Ekle
              </Button>
            </div>
          </div>

          {/* Alt Kategoriler Listesi */}
          <div className="border rounded-md">
            <div className="grid grid-cols-[1fr,1fr,auto] p-4 font-medium border-b">
              <div>Hizmet Türü Adı</div>
              <div>Risk Faktörü</div>
              <div>İşlemler</div>
            </div>

            {subCategories.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {selectedMainCategoryId
                  ? "Bu risk faktörüne ait hizmet türü bulunmamaktadır."
                  : "Lütfen bir risk faktörü seçin."}
              </div>
            ) : (
              <div className="divide-y">
                {subCategories.map((category) => {
                  const mainCategory = mainCategories.find((m) => m.id === category.mainCategoryId)

                  return (
                    <div key={category.id} className="grid grid-cols-[1fr,1fr,auto] p-4 items-center">
                      {editSubCategoryId === category.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editSubCategoryName}
                            onChange={(e) => setEditSubCategoryName(e.target.value)}
                            placeholder="Hizmet türü adı"
                          />
                          <Button size="sm" variant="ghost" onClick={updateSubCategory}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditSubCategoryId(null)
                              setEditSubCategoryName("")
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div>{category.name}</div>
                      )}

                      <div>{mainCategory?.name || "-"}</div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditSubCategoryId(category.id)
                            setEditSubCategoryName(category.name)
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
                              <AlertDialogTitle>Alt Kategoriyi Sil</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bu işlem geri alınamaz. Bu hizmet türünü silmek istediğinizden emin misiniz?
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
                      </div>
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
