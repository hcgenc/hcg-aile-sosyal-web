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

interface ExcelRow {
  firstName: string
  lastName: string
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
    main: Array<{ id: string; name: string }>
    sub: Array<{ id: string; name: string; mainCategoryId: string }>
  }>({ main: [], sub: [] })

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
        main: mainResult.data?.map((item: any) => ({ id: item.id, name: item.name })) || [],
        sub:
          subResult.data?.map((item: any) => ({
            id: item.id,
            name: item.name,
            mainCategoryId: item.main_category_id,
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
      ["İsim", "Soyisim", "İl", "İlçe", "Mahalle", "Adres", "Risk Faktörü", "Hizmet Türü"],
      ["Ahmet", "Yılmaz", "Ankara", "Çankaya", "Kızılay", "Atatürk Bulvarı No:1", "Yaşlı", "Evde Bakım"],
      ["Fatma", "Demir", "İstanbul", "Kadıköy", "Moda", "Moda Caddesi No:15", "Engelli", "Fizik Tedavi"],
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
    <div className="container py-10 px-4 max-w-6xl mx-auto bg-gray-900 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="h-8 w-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-100">Toplu Veri Girişi</h1>
      </div>

      <div className="space-y-6">
        {/* Instructions */}
        <Alert className="bg-blue-900/20 border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-400">Kullanım Talimatları</AlertTitle>
          <AlertDescription className="text-blue-200">
            <ol className="list-decimal pl-4 mt-2 space-y-1">
              <li>Önce şablon dosyasını indirin</li>
              <li>
                Excel dosyasını doldurun (gerekli sütunlar: İsim, Soyisim, İl, İlçe, Mahalle, Adres, Risk Faktörü,
                Hizmet Türü)
              </li>
              <li>Dosyayı yükleyin ve verileri kontrol edin</li>
              <li>"Verileri İşle" butonuna tıklayarak kaydetme işlemini başlatın</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Template Download */}
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-gray-100">1. Şablon İndir</CardTitle>
            <CardDescription className="text-gray-400">
              Önce Excel şablonunu indirin ve gerekli bilgileri doldurun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={downloadTemplate} variant="outline" className="border-gray-600 text-gray-200">
              <Download className="h-4 w-4 mr-2" />
              Excel Şablonunu İndir
            </Button>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-gray-100">2. Excel Dosyası Yükle</CardTitle>
            <CardDescription className="text-gray-400">Doldurduğunuz Excel dosyasını buraya yükleyin.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
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
                  className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Dosya Seç
                </label>
                {file && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200">{file.name}</span>
                    <Button
                      onClick={clearData}
                      variant="ghost"
                      size="sm"
                      disabled={isProcessing}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                        <TableCell className="text-gray-200">{row.province}</TableCell>
                        <TableCell className="text-gray-200">{row.district}</TableCell>
                        <TableCell className="text-gray-200">{row.mainCategory}</TableCell>
                        <TableCell className="text-gray-200">{row.subCategory}</TableCell>
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
  )
}
