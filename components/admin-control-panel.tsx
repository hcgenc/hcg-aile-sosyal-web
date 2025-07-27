'use client'

// ADMIN CONTROL PANEL
// Sadece editor rolündeki kullanıcılar için app kontrol paneli

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, Server, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface AppStatus {
  isActive: boolean
  reason?: string
  updatedAt?: string
  updatedBy?: string
}

export function AdminControlPanel() {
  const { user } = useAuth()
  const [appStatus, setAppStatus] = useState<AppStatus>({ isActive: true })
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  // Sadece editor yetkili kullanıcılar görebilir
  if (!user || user.role !== 'editor') {
    return null
  }

  // Get auth token from localStorage
  const getAuthToken = () => {
    return localStorage.getItem('auth_token')
  }

  // App status'u yükle
  const fetchAppStatus = async () => {
    try {
      const token = getAuthToken()
      if (!token) return

      const response = await fetch('/api/app-control', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAppStatus(data.status)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Status yüklenemedi' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' })
    }
  }

  // App status'u güncelle
  const updateAppStatus = async (newStatus: boolean) => {
    setLoading(true)
    try {
      const token = getAuthToken()
      if (!token) return

      const response = await fetch('/api/app-control', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          active: newStatus,
          reason: reason || (newStatus ? 'Uygulama aktifleştirildi' : 'Uygulama deaktifleştirildi')
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAppStatus(data.status)
        setMessage({ 
          type: 'success', 
          text: newStatus ? 'Uygulama başarıyla aktifleştirildi' : 'Uygulama başarıyla deaktifleştirildi'
        })
        setReason('') // Reset reason
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Güncelleme başarısız' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' })
    }
    setLoading(false)
  }

  // Component mount olduğunda status'u yükle
  useEffect(() => {
    fetchAppStatus()
    
    // Her 30 saniyede bir status'u kontrol et
    const interval = setInterval(fetchAppStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // Message'ı 5 saniye sonra temizle
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Admin Kontrol Paneli
        </CardTitle>
        <CardDescription>
          Uygulamanın genel durumunu kontrol edin
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5" />
            <div>
              <p className="font-medium">Mevcut Durum</p>
              <p className="text-sm text-muted-foreground">
                Son güncelleme: {appStatus.updatedAt ? 
                  new Date(appStatus.updatedAt).toLocaleString('tr-TR') : 
                  'Bilinmiyor'
                }
              </p>
            </div>
          </div>
          <Badge variant={appStatus.isActive ? 'default' : 'destructive'} className="flex items-center gap-1">
            {appStatus.isActive ? (
              <>
                <CheckCircle className="h-3 w-3" />
                AKTİF
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                İNAKTİF
              </>
            )}
          </Badge>
        </div>

        {/* Status Details */}
        {appStatus.reason && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Son Değişiklik:</strong> {appStatus.reason}
              {appStatus.updatedBy && (
                <span className="block text-sm mt-1">
                  Değiştiren: {appStatus.updatedBy}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Status Messages */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Control Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="app-status" className="text-base font-medium">
              Uygulama Durumu
            </Label>
            <Switch
              id="app-status"
              checked={appStatus.isActive}
              onCheckedChange={updateAppStatus}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Durum Değişiklik Sebebi</Label>
            <Textarea
              id="reason"
              placeholder="Durum değişikliği için bir sebep yazın (isteğe bağlı)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-sm text-muted-foreground">
              {reason.length}/500 karakter
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => updateAppStatus(true)}
              disabled={loading || appStatus.isActive}
              variant="default"
              className="flex-1"
            >
              {loading ? 'Güncelleniyor...' : 'Uygulamayı Aktifleştir'}
            </Button>
            <Button
              onClick={() => updateAppStatus(false)}
              disabled={loading || !appStatus.isActive}
              variant="destructive"
              className="flex-1"
            >
              {loading ? 'Güncelleniyor...' : 'Uygulamayı Deaktifleştir'}
            </Button>
          </div>
        </div>

        {/* Warning */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Uyarı:</strong> Uygulamayı deaktifleştirdiğinizde, tüm kullanıcıların API erişimi kesilecek ve 
            uygulama bakım moduna geçecektir. Sadece acil durumlarda kullanın.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
} 