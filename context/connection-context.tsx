'use client'

// CONNECTION STATUS CONTEXT
// Sunucu bağlantısı ve app durumu takibi için
// Realtime subscription ile anlık güncelleme
// Bakım modu kaldırıldı - sadece bağlantı kesildi/bağlandı

import React, { createContext, useContext, useState, useEffect } from 'react'

type ConnectionStatus = 'connected' | 'disconnected' | 'checking'

type ConnectionContextType = {
  status: ConnectionStatus
  isOnline: boolean
  appStatus: {
    isActive: boolean
    reason?: string
    lastChecked?: Date
    disconnectReason?: string
  }
  checkConnection: () => Promise<void>
  retryConnection: () => void
}

const ConnectionContext = createContext<ConnectionContextType>({
  status: 'connected',
  isOnline: true,
  appStatus: { isActive: true },
  checkConnection: async () => {},
  retryConnection: () => {}
})

export const useConnection = () => useContext(ConnectionContext)

export const ConnectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<ConnectionStatus>('connected')
  const [isOnline, setIsOnline] = useState(true)
  const [appStatus, setAppStatus] = useState({
    isActive: true,
    reason: undefined as string | undefined,
    lastChecked: new Date(),
    disconnectReason: undefined as string | undefined
  })

  // Network connectivity check
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (status === 'disconnected') {
        checkConnection()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setStatus('disconnected')
      setAppStatus(prev => ({
        ...prev,
        isActive: false,
        disconnectReason: undefined
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [status])

  // Realtime subscription setup
  useEffect(() => {
    let eventSource: EventSource | null = null
    let retryTimeout: NodeJS.Timeout | null = null

    const setupRealtimeConnection = () => {
      // Server-Sent Events for realtime app status updates
      eventSource = new EventSource('/api/app-status-stream')
      
      eventSource.onopen = () => {
        console.log('✅ Realtime connection established')
        if (status === 'disconnected') {
          setStatus('connected')
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'app_status_update') {
            setAppStatus({
              isActive: data.status.isActive,
              reason: data.status.reason,
              lastChecked: new Date(),
              disconnectReason: data.status.isActive ? undefined : data.status.reason
            })
            
            // Tüm inactive durumları disconnected olarak göster
            setStatus(data.status.isActive ? 'connected' : 'disconnected')
          } else if (data.type === 'heartbeat') {
            // Keep connection alive
            setStatus('connected')
            setAppStatus(prev => ({ ...prev, lastChecked: new Date() }))
          }
        } catch (error) {
          console.error('Error parsing realtime data:', error)
        }
      }

      eventSource.onerror = () => {
        console.log('❌ Realtime connection lost, reconnecting...')
        setStatus('disconnected')
        setAppStatus(prev => ({
          ...prev,
          isActive: false,
          disconnectReason: undefined
        }))
        
        if (eventSource) {
          eventSource.close()
        }
        
        // Retry connection after 3 seconds
        retryTimeout = setTimeout(setupRealtimeConnection, 3000)
      }
    }

    // Start realtime connection
    if (isOnline) {
      setupRealtimeConnection()
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [isOnline])

  // App status check function (for manual retry)
  const checkConnection = async () => {
    if (!isOnline) {
      setStatus('disconnected')
      setAppStatus(prev => ({
        ...prev,
        isActive: false,
        disconnectReason: undefined
      }))
      return
    }

    setStatus('checking')

    try {
      // Test basic connectivity through API proxy
      const connectivityTest = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      })

      if (!connectivityTest.ok) {
        setStatus('disconnected')
        setAppStatus(prev => ({
          ...prev,
          isActive: false,
          disconnectReason: undefined
        }))
        return
      }

      // Check app status if user is logged in
      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          const appStatusResponse = await fetch('/api/app-control', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (appStatusResponse.status === 503) {
            // App is inactive - treat as disconnected
            setStatus('disconnected')
            const errorData = await appStatusResponse.json()
            setAppStatus({
              isActive: false,
              reason: errorData.reason,
              lastChecked: new Date(),
              disconnectReason: errorData.reason
            })
            return
          } else if (appStatusResponse.ok) {
            const data = await appStatusResponse.json()
            setAppStatus({
              isActive: data.status.isActive,
              reason: data.status.reason,
              lastChecked: new Date(),
              disconnectReason: data.status.isActive ? undefined : data.status.reason
            })
            
            // Inactive app status'u da disconnected olarak göster
            setStatus(data.status.isActive ? 'connected' : 'disconnected')
            return
          }
        } catch (error) {
          // Non-admin user or other error, continue with normal check
        }
      }

      // If we reach here, everything is working
      setStatus('connected')
      setAppStatus(prev => ({ 
        ...prev, 
        isActive: true, 
        lastChecked: new Date(),
        disconnectReason: undefined
      }))

    } catch (error) {
      console.error('Connection check failed:', error)
      setStatus('disconnected')
      setAppStatus(prev => ({
        ...prev,
        isActive: false,
        disconnectReason: undefined
      }))
    }
  }

  // Retry connection
  const retryConnection = () => {
    checkConnection()
  }

  // Initial connection check (only once)
  useEffect(() => {
    checkConnection()
  }, [])

  // Monitor API responses for app inactive status
  useEffect(() => {
    // Intercept fetch to detect app inactive responses
    const originalFetch = window.fetch
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        
        // Check if this is an app inactive response
        if (response.status === 503) {
          let url = ''
          if (typeof args[0] === 'string') {
            url = args[0]
          } else if (args[0] instanceof Request) {
            url = args[0].url
          } else if (args[0] instanceof URL) {
            url = args[0].toString()
          }
          
          if (url.includes('/api/') && !url.includes('/api/app-control') && !url.includes('/api/app-status-stream')) {
            setStatus('disconnected')
            setAppStatus(prev => ({
              ...prev,
              isActive: false,
              disconnectReason: undefined
            }))
          }
        }
        
        return response
      } catch (error) {
        // Network error - check if offline
        if (!navigator.onLine) {
          setStatus('disconnected')
          setAppStatus(prev => ({
            ...prev,
            isActive: false,
            disconnectReason: undefined
          }))
        }
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return (
    <ConnectionContext.Provider
      value={{
        status,
        isOnline,
        appStatus,
        checkConnection,
        retryConnection
      }}
    >
      {children}
    </ConnectionContext.Provider>
  )
} 