"use client"

import { useState, useEffect } from "react"
import { useSupabase } from "@/context/supabase-context"
import { useAuth } from "@/context/auth-context"
import { Key, Save, Eye, EyeOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { updateYandexApiKey } from "@/lib/yandex-maps"

interface ApiKey {
  id: string
  service_name: string
  api_key: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ApiManagementPage() {
  const { supabase } = useSupabase()
  const { hasPermission, logAction } = useAuth()

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({})

  const loadApiKeys = async () => {
    if (!supabase) return

    setIsLoading(true)
    try {
      const result = await supabase.select("api_keys", {
        select: "*",
        orderBy: { column: "service_name", ascending: true }
      })

      if (result.error) throw result.error

      if (result.data) {
        setApiKeys(result.data.map((item: any) => ({
          id: item.id,
          service_name: item.service_name,
          api_key: item.key_value,
          description: item.description,
          is_active: item.is_active,
          created_at: item.created_at,
          updated_at: item.updated_at,
        })))
      }
    } catch (error) {
      console.error("API anahtarları yüklenirken hata:", error)
      toast({
        title: "Hata",
        description: "API anahtarları yüklenirken bir sorun oluştu.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateApiKey = async (id: string, serviceName: string) => {
    if (!supabase || !newApiKey.trim()) return

    try {
      const { error } = await supabase
        .from("api_keys")
        .update({
          api_key: newApiKey.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      if (serviceName === "yandex_maps") {
        await updateYandexApiKey(newApiKey.trim())
      }

      await logAction("UPDATE_API_KEY", `Updated API key for service: ${serviceName}`)

      toast({
        title: "Başarılı",
        description: "API anahtarı başarıyla güncellendi.",
      })

      setEditingKey(null)
      setNewApiKey("")
      loadApiKeys()
    } catch (error) {
      console.error("API anahtarı güncellenirken hata:", error)
      toast({
        title: "Hata",
        description: "API anahtarı güncellenirken bir sorun oluştu.",
        variant: "destructive",
      })
    }
  }

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKey((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const startEditing = (apiKey: ApiKey) => {
    setEditingKey(apiKey.id)
    setNewApiKey(apiKey.api_key)
  }

  const cancelEditing = () => {
    setEditingKey(null)
    setNewApiKey("")
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString))
  }

  const getServiceDisplayName = (serviceName: string) => {
    switch (serviceName) {
      case "yandex_maps":
        return "Yandex Haritalar"
      default:
        return serviceName
    }
  }

  useEffect(() => {
    loadApiKeys()
  }, [supabase])

  if (!hasPermission("MANAGE_CATEGORIES")) {
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
    <div className="container py-10 px-4 max-w-4xl mx-auto bg-gray-900 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Key className="h-8 w-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-100">API Anahtar Yönetimi</h1>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-gray-400">API anahtarları yükleniyor...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <Card className="bg-gray-800 border-gray-600">
            <CardContent className="text-center py-8">
              <p className="text-gray-400">Henüz API anahtarı bulunmamaktadır.</p>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((apiKey) => (
            <Card key={apiKey.id} className="bg-gray-800 border-gray-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-100 flex items-center gap-2">
                      {getServiceDisplayName(apiKey.service_name)}
                      {apiKey.is_active ? (
                        <Badge variant="default" className="bg-green-600">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-600">
                          Pasif
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {apiKey.description || "Açıklama bulunmuyor"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-200 mb-2 block">API Anahtarı</Label>
                  {editingKey === apiKey.id ? (
                    <div className="space-y-3">
                      <Input
                        type="text"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder="Yeni API anahtarını girin"
                        className="bg-gray-700 border-gray-600 text-gray-100"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateApiKey(apiKey.id, apiKey.service_name)}
                          disabled={!newApiKey.trim()}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Kaydet
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          className="border-gray-600 text-gray-200 hover:bg-gray-700"
                        >
                          İptal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 p-3 rounded-md font-mono text-sm">
                        {showApiKey[apiKey.id] ? (
                          <span className="text-gray-200">{apiKey.api_key}</span>
                        ) : (
                          <span className="text-gray-400">{"•".repeat(32)}</span>
                        )}
                      </div>
                      <Button
                        onClick={() => toggleApiKeyVisibility(apiKey.id)}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-200 hover:bg-gray-700"
                      >
                        {showApiKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={() => startEditing(apiKey)}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-200 hover:bg-gray-700"
                      >
                        Düzenle
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Oluşturulma:</span>
                    <p className="text-gray-200">{formatDate(apiKey.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Son Güncelleme:</span>
                    <p className="text-gray-200">{formatDate(apiKey.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
