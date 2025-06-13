"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/context/supabase-context"
import { useMap } from "@/context/map-context"
import { useAuth } from "@/context/auth-context"
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, X, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import * as XLSX from "xlsx"
import { geocodeAddressEnhanced } from "@/lib/yandex-maps"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ExcelRow {
  firstName: string
  lastName: string
  gender?: string
  province: string
  district: string
  neighborhood: string
  address: string
  mainCategory: string
  subCategory: string
  latitude?: number
  longitude?: number
  status?: "pending" | "processing" | "success" | "error"
  error?: string
}

interface ProcessingStats {
  total: number
  processed: number
  success: number
  errors: number
}

export default function BulkDataEntryPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { refreshMarkers } = useMap()
  const { hasPermission, logAction } = useAuth()

  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<ExcelRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    total: 0,
    processed: 0,
    success: 0,
    errors: 0,
  })
  const [categories, setCategories] = useState<{
    main: Array<{ id: string; name: string; color: string }>
    sub: Array<{ id: string; name: string; mainCategoryId: string; color: string }>
  }>({ main: [], sub: [] })
  const [showGuideModal, setShowGuideModal] = useState(false)

  // Load categories
  const loadCategories = async () => {
    if (!supabase) return

    try {
      const [mainResult, subResult] = await Promise.all([
        supabase.select("main_categories", {
          select: "*",
          orderBy: { column: "name", ascending: true }
        }),
        supabase.select("sub_categories", {
          select: "*",
          orderBy: { column: "name", ascending: true }
        }),
      ])

      if (mainResult.error) throw mainResult.error
      if (subResult.error) throw subResult.error

      setCategories({
        main: mainResult.data?.map((item: any) => ({ id: item.id, name: item.name, color: item.color || "#3B82F6" })) || [],
        sub:
          subResult.data?.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
            color: item.color || "#3B82F6",
          })) || [],
      })
    } catch (error) {
      console.error("Kategoriler yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "Kategoriler yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFile = event.target.files?.[0]
      if (!uploadedFile) return

      if (!uploadedFile.name.match(/\.(xlsx|xls)$/)) {
        toast({
          title: "Hata",
          description: "Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls).",
          variant: "destructive",
        })
        return
      }

      setFile(uploadedFile)
      parseExcelFile(uploadedFile)
    },
    [supabase],
  )

  // Parse Excel file
  const parseExcelFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length < 2) {
        toast({
          title: "Hata",
          description: "Excel dosyası en az 2 satır içermelidir (başlık + veri).",
          variant: "destructive",
        })
        return
      }

      // Expected headers
      const expectedHeaders = ["İsim", "Soyisim", "İl", "İlçe", "Mahalle", "Adres", "Risk Faktörü", "Hizmet Türü"]

      const headers = jsonData[0] as string[]
      const rows = jsonData.slice(1) as string[][]

      // Validate headers
      const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header))
      if (missingHeaders.length > 0) {
        toast({
          title: "Hata",
          description: `Eksik sütunlar: ${missingHeaders.join(", ")}`,
          variant: "destructive",
        })
        return
      }

      // Parse data
      const parsedData: ExcelRow[] = rows
        .filter((row) => row.some((cell) => cell && cell.toString().trim())) // Filter empty rows
        .map((row, index) => ({
          firstName: (row[headers.indexOf("İsim")] || "").toString().trim(),
          lastName: (row[headers.indexOf("Soyisim")] || "").toString().trim(),
          gender: (row[headers.indexOf("Cinsiyet")] || "").toString().trim() || undefined,
          province: (row[headers.indexOf("İl")] || "").toString().trim(),
          district: (row[headers.indexOf("İlçe")] || "").toString().trim(),
          neighborhood: (row[headers.indexOf("Mahalle")] || "").toString().trim(),
          address: (row[headers.indexOf("Adres")] || "").toString().trim(),
          mainCategory: (row[headers.indexOf("Risk Faktörü")] || "").toString().trim(),
          subCategory: (row[headers.indexOf("Hizmet Türü")] || "").toString().trim(),
          status: "pending",
        }))

      // Validate required fields
      const validData = parsedData.filter((row, index) => {
        const errors = []
        if (!row.firstName) errors.push("İsim")
        if (!row.lastName) errors.push("Soyisim")
        if (!row.province) errors.push("İl")
        if (!row.district) errors.push("İlçe")
        if (!row.neighborhood) errors.push("Mahalle")
        if (!row.address) errors.push("Adres")
        if (!row.mainCategory) errors.push("Risk Faktörü")
        if (!row.subCategory) errors.push("Hizmet Türü")

        if (errors.length > 0) {
          row.status = "error"
          row.error = `Eksik alanlar: ${errors.join(", ")}`
          return true // Keep for display
        }
        return true
      })

      setData(validData)
      await loadCategories()

      toast({
        title: "Başarılı",
        description: `${validData.length} satır başarıyla yüklendi.`,
      })
    } catch (error) {
      console.error("Excel dosyası işlenirken hata:", error)
      toast({
        title: "Hata",
        description: "Excel dosyası işlenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  // Process data and save to database
  const processData = async () => {
    if (!supabase || data.length === 0) return

    setIsProcessing(true)
    setProcessingStats({ total: data.length, processed: 0, success: 0, errors: 0 })

    const updatedData = [...data]
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i]

      if (row.status === "error") {
        errorCount++
        setProcessingStats((prev) => ({
          ...prev,
          processed: prev.processed + 1,
          errors: prev.errors + 1,
        }))
        continue
      }

      try {
        row.status = "processing"
        setData([...updatedData])

        // Find category IDs
        const mainCategory = categories.main.find((cat) => cat.name === row.mainCategory)
        const subCategory = categories.sub.find(
          (cat) => cat.name === row.subCategory && cat.mainCategoryId === mainCategory?.id,
        )

        if (!mainCategory || !subCategory) {
          throw new Error("Kategori bulunamadı")
        }

        // Geocode address
        const geocodeResult = await geocodeAddressEnhanced(row.province, row.district, row.neighborhood, row.address)

        if (!geocodeResult) {
          throw new Error("Adres koordinatları bulunamadı")
        }

        row.latitude = geocodeResult.coords[0]
        row.longitude = geocodeResult.coords[1]

        // Save to database
        const result = await supabase.insert("addresses", {
          first_name: row.firstName,
          last_name: row.lastName,
          gender: row.gender || null,
          province: row.province,
          district: row.district,
          neighborhood: row.neighborhood,
          address: row.address,
          latitude: row.latitude,
          longitude: row.longitude,
          main_category_id: mainCategory.id,
          sub_category_id: subCategory.id,
        })

        if (result.error) throw result.error

        row.status = "success"
        successCount++
      } catch (error) {
        row.status = "error"
        row.error = error instanceof Error ? error.message : "Bilinmeyen hata"
        errorCount++
      }

      setProcessingStats((prev) => ({
        ...prev,
        processed: prev.processed + 1,
        success: successCount,
        errors: errorCount,
      }))

      setData([...updatedData])

      // Small delay to prevent overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    await logAction("BULK_DATA_IMPORT", `Imported ${successCount} addresses, ${errorCount} errors`)

    toast({
      title: "İşlem Tamamlandı",
      description: `${successCount} adres başarıyla kaydedildi, ${errorCount} hata oluştu.`,
    })

    // Refresh map markers
    refreshMarkers()
    setIsProcessing(false)
  }

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      ["İsim", "Soyisim", "Cinsiyet", "İl", "İlçe", "Mahalle", "Adres", "Risk Faktörü", "Hizmet Türü"],
      ["Ahmet", "Yılmaz", "Erkek", "Ankara", "Çankaya", "Kızılay", "Atatürk Bulvarı No:1", "Yaşlı", "Evde Bakım"],
      ["Fatma", "Demir", "Kadın", "İstanbul", "Kadıköy", "Moda", "Moda Caddesi No:15", "Engelli", "Fiziksel Engelli Desteği"],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Şablon")

    // Use browser-compatible file download
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "toplu_veri_girisi_sablonu.xlsx"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    logAction("DOWNLOAD_TEMPLATE", "Downloaded bulk data entry template")
  }

  // Clear data
  const clearData = () => {
    setFile(null)
    setData([])
    setProcessingStats({ total: 0, processed: 0, success: 0, errors: 0 })
  }

  // Check permissions
  if (!hasPermission("ADD_ADDRESS")) {
    return (
      <div className="container py-10 px-4 max-w-4xl mx-auto bg-gray-900 min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-100">Erişim Reddedildi</h1>
          <p className="text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="container py-10 px-4 max-w-6xl mx-auto bg-gray-900 min-h-screen pt-20 md:pt-10">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="h-8 w-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-100">Toplu Veri Girişi</h1>
        </div>

        <div className="space-y-6">
          {/* Simple Notice */}
          <Alert className="bg-blue-900/20 border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-400">Başlamadan Önce</AlertTitle>
            <AlertDescription className="text-blue-200">
              İlk defa kullanıyorsanız, lütfen aşağıdaki "Detaylı Kılavuz" butonuna tıklayarak 
              adım adım talimatları okuyun.
            </AlertDescription>
          </Alert>

                  {/* 3-Step Process */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1: Guide */}
            <Card className="bg-gray-800 border-gray-600 relative h-[280px] flex flex-col">
              <div className="absolute -top-3 left-4">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  1
                </div>
              </div>
              <CardHeader className="pt-8 flex-1">
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  Kılavuzu Okuyun
                </CardTitle>
                <CardDescription className="text-gray-400">
                  İlk adım olarak detaylı kullanım kılavuzunu inceleyin
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <Button 
                  onClick={() => setShowGuideModal(true)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Detaylı Kılavuzu Aç
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Template */}
            <Card className="bg-gray-800 border-gray-600 relative h-[280px] flex flex-col">
              <div className="absolute -top-3 left-4">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  2
                </div>
              </div>
              <CardHeader className="pt-8 flex-1">
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-400" />
                  Şablon İndirin
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Excel şablonunu indirip gerekli bilgileri doldurun
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <Button 
                  onClick={downloadTemplate} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel Şablonunu İndir
                </Button>
              </CardContent>
            </Card>

            {/* Step 3: Upload */}
            <Card className="bg-gray-800 border-gray-600 relative h-[280px] flex flex-col">
              <div className="absolute -top-3 left-4">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  3
                </div>
              </div>
              <CardHeader className="pt-8 flex-1">
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-400" />
                  Dosya Yükleyin
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Doldurduğunuz Excel dosyasını sisteme yükleyin
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6 space-y-4">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-upload"
                  disabled={isProcessing}
                />
                <label
                  htmlFor="excel-upload"
                  className="cursor-pointer w-full inline-flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Dosya Seç
                </label>
                {file && (
                  <div className="flex items-center justify-between bg-gray-700 rounded p-2">
                    <span className="text-gray-200 text-sm truncate">{file.name}</span>
                    <Button
                      onClick={clearData}
                      variant="ghost"
                      size="sm"
                      disabled={isProcessing}
                      className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        {/* Data Preview */}
        {data.length > 0 && (
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-100">3. Veri Önizleme</CardTitle>
                  <CardDescription className="text-gray-400">
                    Yüklenen veriler aşağıda görüntülenmektedir. Kontrol edin ve işleme başlayın.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={processData}
                    disabled={isProcessing || data.every((row) => row.status === "error")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Verileri İşle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Processing Stats */}
              {isProcessing && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>İşleniyor...</span>
                    <span>
                      {processingStats.processed} / {processingStats.total}
                    </span>
                  </div>
                  <Progress value={(processingStats.processed / processingStats.total) * 100} className="h-2" />
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">Başarılı: {processingStats.success}</span>
                    <span className="text-red-400">Hata: {processingStats.errors}</span>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="border rounded-md overflow-hidden border-gray-600">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-600">
                      <TableHead className="text-gray-200">Durum</TableHead>
                      <TableHead className="text-gray-200">İsim</TableHead>
                      <TableHead className="text-gray-200">Soyisim</TableHead>
                      <TableHead className="text-gray-200">Cinsiyet</TableHead>
                      <TableHead className="text-gray-200">İl</TableHead>
                      <TableHead className="text-gray-200">İlçe</TableHead>
                      <TableHead className="text-gray-200">Risk Faktörü</TableHead>
                      <TableHead className="text-gray-200">Hizmet Türü</TableHead>
                      <TableHead className="text-gray-200">Hata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, index) => (
                      <TableRow key={index} className="border-gray-600">
                        <TableCell>
                          {row.status === "pending" && (
                            <Badge variant="secondary" className="bg-gray-600">
                              Bekliyor
                            </Badge>
                          )}
                          {row.status === "processing" && (
                            <Badge variant="secondary" className="bg-blue-600">
                              İşleniyor
                            </Badge>
                          )}
                          {row.status === "success" && (
                            <Badge variant="secondary" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Başarılı
                            </Badge>
                          )}
                          {row.status === "error" && (
                            <Badge variant="secondary" className="bg-red-600">
                              <X className="h-3 w-3 mr-1" />
                              Hata
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-200">{row.firstName}</TableCell>
                        <TableCell className="text-gray-200">{row.lastName}</TableCell>
                        <TableCell className="text-gray-200">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            row.gender === 'Erkek' ? 'bg-blue-900/50 text-blue-300' :
                            row.gender === 'Kadın' ? 'bg-pink-900/50 text-pink-300' :
                            'bg-gray-700/50 text-gray-400'
                          }`}>
                            {row.gender || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-200">{row.province}</TableCell>
                        <TableCell className="text-gray-200">{row.district}</TableCell>
                        <TableCell className="text-gray-200">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                              style={{ 
                                backgroundColor: categories.main.find(cat => cat.name === row.mainCategory)?.color || "#3B82F6",
                                boxShadow: `0 1px 3px ${categories.main.find(cat => cat.name === row.mainCategory)?.color || "#3B82F6"}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                              />
                            </div>
                            {row.mainCategory}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-200">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm relative overflow-hidden"
                              style={{ 
                                backgroundColor: categories.sub.find(cat => cat.name === row.subCategory)?.color || "#3B82F6",
                                boxShadow: `0 1px 3px ${categories.sub.find(cat => cat.name === row.subCategory)?.color || "#3B82F6"}30`
                              }}
                            >
                              {/* Mini parıltı efekti */}
                              <div 
                                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent"
                              />
                            </div>
                            {row.subCategory}
                          </div>
                        </TableCell>
                        <TableCell className="text-red-400 text-xs">{row.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>

    {/* Detailed Guide Modal */}
    <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900 border-gray-600">
        <DialogHeader>
          <DialogTitle className="text-xl text-gray-100 flex items-center gap-2">
            <span className="text-2xl">📋</span>
            Toplu Veri Girişi - Detaylı Kılavuz
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[75vh] pr-4">
          <div className="space-y-6">
            {/* Overview */}
            <Alert className="bg-blue-900/20 border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <AlertTitle className="text-blue-400 text-lg">📋 Genel Bakış</AlertTitle>
              <AlertDescription className="text-blue-200 mt-3">
                <p className="mb-3">
                  Bu özellik ile Excel dosyası kullanarak aynı anda yüzlerce adres kaydı ekleyebilirsiniz. 
                  İşlem tamamen otomatik olup, her adres için koordinat bulma ve kategori eşleştirme yapılır.
                </p>
                <div className="bg-blue-800/30 rounded-lg p-4 mt-4">
                  <h4 className="font-semibold mb-2">⏱️ İşlem Süresi:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• 10 kayıt: ~30 saniye</li>
                    <li>• 50 kayıt: ~2-3 dakika</li>
                    <li>• 100+ kayıt: ~5-10 dakika</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Step by Step Guide */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Prerequisites */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-gray-100 flex items-center gap-2">
                    <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">!</span>
                    Önkoşullar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-gray-300">
                    <h4 className="font-semibold text-yellow-400 mb-2">🏷️ Kategoriler Hazır Olmalı:</h4>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Risk faktörleri sisteme eklenmiş olmalı</li>
                      <li>• Her risk faktörü için hizmet türleri tanımlanmalı</li>
                      <li>• Kategori isimleri Excel'de TAM AYNI yazılmalı</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3">
                    <p className="text-yellow-300 text-xs">
                      💡 <strong>İpucu:</strong> Kategori Yönetimi sayfasından mevcut kategorileri kontrol edin
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* File Requirements */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-gray-100 flex items-center gap-2">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">📄</span>
                    Dosya Gereksinimleri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-gray-300">
                    <h4 className="font-semibold text-green-400 mb-2">✅ Desteklenen Formatlar:</h4>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Excel (.xlsx) - Önerilen</li>
                      <li>• Eski Excel (.xls)</li>
                    </ul>
                    
                    <h4 className="font-semibold text-red-400 mb-2 mt-3">❌ Desteklenmeyen:</h4>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• CSV dosyaları</li>
                      <li>• PDF veya Word dosyaları</li>
                      <li>• Google Sheets (önce Excel'e dönüştürün)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Required Columns */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">📊</span>
                  Gerekli Sütunlar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-red-400 mb-3">🔴 ZORUNLU Sütunlar:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">İsim</span> - Kişinin adı
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">Soyisim</span> - Kişinin soyadı
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">İl</span> - Şehir adı (örn: Ankara)
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">İlçe</span> - İlçe adı (örn: Çankaya)
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">Mahalle</span> - Mahalle adı
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">Adres</span> - Detaylı adres
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">Risk Faktörü</span> - Sistemdeki kategori adı
                      </div>
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <span className="font-mono text-red-300">Hizmet Türü</span> - Sistemdeki alt kategori adı
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-blue-400 mb-3">🔵 OPSİYONEL Sütunlar:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="bg-blue-900/20 border border-blue-600 rounded p-2">
                        <span className="font-mono text-blue-300">Cinsiyet</span> - Erkek/Kadın (boş bırakılabilir)
                      </div>
                    </div>
                    
                    <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3 mt-4">
                      <h5 className="font-semibold text-yellow-300 mb-2">⚠️ ÖNEMLİ UYARILAR:</h5>
                      <ul className="text-yellow-200 text-xs space-y-1">
                        <li>• Sütun başlıkları AYNEN yukarıdaki gibi olmalı</li>
                        <li>• Risk faktörü ve hizmet türü isimleri sistemdekilerle TAM EŞLEŞMELİ</li>
                        <li>• Boş satırlar otomatik atlanır</li>
                        <li>• Eksik zorunlu alan varsa o satır hata olur</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Processing Details */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">⚙️</span>
                  İşlem Detayları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-400">✅ Başarılı İşlem</h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>• Kategori eşleştirmesi bulundu</p>
                      <p>• Adres koordinatları belirlendi</p>
                      <p>• Veritabanına kaydedildi</p>
                      <p>• Haritada görünür hale geldi</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-600 rounded p-2">
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Başarılı
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-yellow-400">⚠️ Olası Hatalar</h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>• "Kategori bulunamadı"</p>
                      <p>• "Adres koordinatları bulunamadı"</p>
                      <p>• "Eksik alanlar: İsim, Soyisim..."</p>
                      <p>• "Hizmet türü risk faktörüne ait değil"</p>
                    </div>
                    <div className="bg-red-900/20 border border-red-600 rounded p-2">
                      <Badge className="bg-red-600">
                        <X className="h-3 w-3 mr-1" />
                        Hata
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-400">🔄 İşlem Durumları</h4>
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gray-600">Bekliyor</Badge>
                        <span className="text-gray-300">Henüz işlenmedi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600">İşleniyor</Badge>
                        <span className="text-gray-300">Şu anda işleniyor</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips and Best Practices */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-gray-100 flex items-center gap-2">
                  <span className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">💡</span>
                  İpuçları ve En İyi Uygulamalar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-green-400 mb-3">✅ YAPILMASI GEREKENLER:</h4>
                    <ul className="text-sm text-gray-300 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>Önce şablonu indirin ve örnek verileri inceleyin</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>Kategori isimlerini Kategori Yönetimi'nden kopyalayın</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>Adresleri mümkün olduğunca detaylı yazın</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>İşlem başlamadan önce veri önizlemesini kontrol edin</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-red-400 mb-3">❌ YAPILMAMASI GEREKENLER:</h4>
                    <ul className="text-sm text-gray-300 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>İşlem devam ederken sayfadan çıkmayın</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>Kategori isimlerini tahmin etmeye çalışmayın</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>Sütun başlıklarını değiştirmeyin</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>Hatalı satırları düzeltmeden tekrar yüklemeyin</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-blue-900/20 border border-blue-600 rounded p-4 mt-6">
                  <h5 className="font-semibold text-blue-300 mb-2">🎯 Başarı Oranını Artırma İpuçları:</h5>
                  <div className="grid gap-3 md:grid-cols-2 text-sm text-blue-200">
                    <div>
                      <p><strong>Adres Kalitesi:</strong></p>
                      <p>• "Atatürk Bulvarı No:123/A" ✅</p>
                      <p>• "Atatürk Bulvarı" ❌</p>
                    </div>
                    <div>
                      <p><strong>Kategori Eşleştirme:</strong></p>
                      <p>• Sistemden kopyala-yapıştır yapın</p>
                      <p>• Büyük/küçük harf uyumuna dikkat edin</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  )
}
