'use client'

// CONNECTION STATUS COMPONENT
// Güzel animasyonlu bağlantı durumu göstergesi
// Sadece bağlantı kesildi/bağlandı durumları

import React, { useState, useEffect } from 'react'
import { useConnection } from '@/context/connection-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  Clock
} from 'lucide-react'

export function ConnectionStatus() {
  const { status, isOnline, appStatus, retryConnection } = useConnection()
  const [isRetrying, setIsRetrying] = useState(false)

  // Don't show anything if connected
  if (status === 'connected') {
    return null
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    await retryConnection()
    setTimeout(() => setIsRetrying(false), 2000)
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'disconnected':
        return {
          icon: WifiOff,
          title: 'Bağlantı Kesildi',
          message: appStatus.reason || appStatus.disconnectReason || '',
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-950/30',
          borderColor: 'border-red-200 dark:border-red-800',
          buttonText: 'Yeniden Dene',
          buttonVariant: 'destructive' as const,
          showRetry: true
        }
      case 'checking':
        return {
          icon: Loader2,
          title: 'Bağlantı Kontrol Ediliyor',
          message: 'Sunucu durumu kontrol ediliyor...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          buttonText: 'Kontrol Ediliyor...',
          buttonVariant: 'default' as const,
          showRetry: false
        }
      default:
        return {
          icon: AlertTriangle,
          title: 'Bilinmeyen Durum',
          message: 'Bir sorun oluştu.',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-950/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          buttonText: 'Yeniden Dene',
          buttonVariant: 'default' as const,
          showRetry: true
        }
    }
  }

  const config = getStatusConfig()
  const IconComponent = config.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <Card className={`w-full max-w-lg mx-auto ${config.bgColor} ${config.borderColor} border-2 shadow-2xl backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-700`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon with Animation */}
          <div className="flex justify-center">
            <div className={`p-6 rounded-full ${config.bgColor} ${config.borderColor} border-2 shadow-inner`}>
              <IconComponent 
                className={`h-16 w-16 ${config.color} ${
                  status === 'checking' ? 'animate-spin' : 
                  status === 'disconnected' ? 'animate-pulse' : ''
                }`} 
              />
            </div>
          </div>

          {/* Title and Message */}
          <div className="space-y-3">
            <h2 className={`text-3xl font-bold ${config.color}`}>
              {config.title}
            </h2>
            {/* Only show message for non-disconnected states */}
            {status !== 'disconnected' && config.message && (
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                {config.message}
              </p>
            )}
            {/* Display reason prominently if available */}
            {status === 'disconnected' && (
              <div className="mt-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
                {appStatus.reason ? (
                  <p className="text-red-800 dark:text-red-200 font-semibold text-lg text-center">
                    {appStatus.reason}
                  </p>
                ) : (
                  <p className="text-red-600 dark:text-red-400 text-sm text-center italic">
                    Debug: reason boş - appStatus: {JSON.stringify(appStatus)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {config.showRetry && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying || status === 'checking'}
                className="w-full py-3 text-lg"
                size="lg"
                variant={config.buttonVariant}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Deneniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className={`mr-2 h-5 w-5 ${isRetrying ? 'animate-spin' : ''}`} />
                    {config.buttonText}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Progress Indicator for Checking */}
          {status === 'checking' && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 animate-pulse">
                <div className="bg-blue-500 h-3 rounded-full animate-pulse transition-all duration-1000" style={{ width: '70%' }}></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bağlantı test ediliyor...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtle background effect - only when checking */}
      {status === 'checking' && (
        <div className="fixed inset-0 -z-10 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/30 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-purple-500/30 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
        </div>
      )}
    </div>
  )
}

// Compact version for header/navbar
export function ConnectionStatusIndicator() {
  const { status } = useConnection()

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Bağlı</span>
      </div>
    )
  }

  const getIndicatorConfig = () => {
    switch (status) {
      case 'disconnected':
        return { icon: WifiOff, text: 'Bağlantı Yok', color: 'text-red-600 dark:text-red-400' }
      case 'checking':
        return { icon: Loader2, text: 'Kontrol...', color: 'text-blue-600 dark:text-blue-400' }
      default:
        return { icon: AlertTriangle, text: 'Hata', color: 'text-gray-600 dark:text-gray-400' }
    }
  }

  const config = getIndicatorConfig()
  const IconComponent = config.icon

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <IconComponent className={`h-4 w-4 ${status === 'checking' ? 'animate-spin' : 'animate-pulse'}`} />
      <span className="text-xs font-medium">{config.text}</span>
    </div>
  )
} 