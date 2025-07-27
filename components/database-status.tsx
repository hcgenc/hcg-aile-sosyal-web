"use client"

import { useEffect, useState } from "react"
import { useSupabase } from "@/context/supabase-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

// Bağlantı durumunu takip etmek için global değişken
let connectionShown = false

export function DatabaseStatus() {
  const { supabase } = useSupabase()
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    async function checkConnection() {
      if (!supabase) return

      try {
        // Ana kategoriler tablosunu kontrol et
        const mainCategoriesResult = await supabase.select("main_categories", {
          select: "count",
          limit: 1
        })

        if (mainCategoriesResult.error) {
          throw new Error(`Ana kategoriler tablosu hatası: ${mainCategoriesResult.error.message}`)
        }

        // Alt kategoriler tablosunu kontrol et
        const subCategoriesResult = await supabase.select("sub_categories", {
          select: "count",
          limit: 1
        })

        if (subCategoriesResult.error) {
          throw new Error(`Alt kategoriler tablosu hatası: ${subCategoriesResult.error.message}`)
        }

        // Adresler tablosunu kontrol et
        const addressesResult = await supabase.select("addresses", {
          select: "count",
          limit: 1
        })

        if (addressesResult.error) {
          throw new Error(`Adresler tablosu hatası: ${addressesResult.error.message}`)
        }

        setStatus("connected")

        // Eğer bağlantı mesajı daha önce gösterildiyse, görünürlüğü kapat
        if (connectionShown) {
          setVisible(false)
        } else {
          // İlk kez gösteriliyor, 3 saniye sonra kapat
          connectionShown = true
          const timer = setTimeout(() => {
            setVisible(false)
          }, 3000)

          return () => clearTimeout(timer)
        }
      } catch (error) {
        console.error("Veritabanı bağlantı hatası:", error)
        setStatus("error")
        setErrorMessage(error instanceof Error ? error.message : "Bilinmeyen hata")
      }
    }

    if (supabase) {
      checkConnection()
    }
  }, [supabase])

  if (!visible) {
    return null
  }

  if (status === "checking") {
    return (
      <Alert className="mb-4 bg-gray-800 border-gray-600 text-gray-100">
        <AlertCircle className="h-4 w-4 text-blue-400" />
        <AlertTitle className="text-gray-100">Veritabanı bağlantısı kontrol ediliyor...</AlertTitle>
        <AlertDescription className="text-gray-300">
          Lütfen bekleyin, veritabanı bağlantısı kontrol ediliyor.
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "error") {
    return (
      <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-700 text-red-100">
        <AlertCircle className="h-4 w-4 text-red-400" />
        <AlertTitle className="text-red-100">Veritabanı bağlantı hatası!</AlertTitle>
        <AlertDescription className="text-red-200">
          {errorMessage}
          <br />
          Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-4 bg-green-900/50 border-green-700 text-green-100">
      <CheckCircle2 className="h-4 w-4 text-green-400" />
      <AlertTitle className="text-green-100">Veritabanı bağlantısı başarılı</AlertTitle>
      <AlertDescription className="text-green-200">
        Veritabanına başarıyla bağlandınız. Uygulamayı kullanabilirsiniz.
      </AlertDescription>
    </Alert>
  )
}
