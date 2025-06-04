'use client'



import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

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

  // Debounce refs for stable connection handling
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastConnectionTimeRef = useRef<number>(Date.now())
  const consecutiveErrorsRef = useRef<number>(0)

  // Network connectivity check
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network back online')
      setIsOnline(true)
      consecutiveErrorsRef.current = 0
      if (status === 'disconnected') {
        checkConnection()
      }
    }

    const handleOffline = () => {
      console.log('🌐 Network offline detected')
      setIsOnline(false)
      setStatus('disconnected')
      setAppStatus(prev => ({
        ...prev,
        disconnectReason: 'Network offline'
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

  // Debounced disconnect function
  const handleDisconnect = (reason: string, force: boolean = false) => {
    // Clear any existing timeout
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current)
    }

    // If this is a forced disconnect (like app inactive), apply immediately
    if (force) {
      console.log('🔴 Forced disconnect:', reason)
      setStatus('disconnected')
      setAppStatus(prev => ({
        ...prev,
        disconnectReason: reason
      }))
      return
    }

    // For temporary issues, wait 2 seconds before showing disconnected (reduced for debugging)
    console.log('⚠️ Potential disconnect detected:', reason)
    disconnectTimeoutRef.current = setTimeout(() => {
      const timeSinceLastConnection = Date.now() - lastConnectionTimeRef.current
      
      // Only show disconnected if we haven't had a successful connection in the last 2 seconds
      if (timeSinceLastConnection > 2000) {
        console.log('🔴 Confirmed disconnect after timeout:', reason)
        setStatus('disconnected')
        setAppStatus(prev => ({
          ...prev,
          disconnectReason: reason
        }))
      } else {
        console.log('✅ Connection recovered before timeout, ignoring temporary issue')
      }
    }, 2000) // 2 second delay for debugging
  }

  // Handle successful connection
  const handleConnect = () => {
    // Clear any pending disconnect timeout
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current)
      disconnectTimeoutRef.current = null
    }

    lastConnectionTimeRef.current = Date.now()
    consecutiveErrorsRef.current = 0
    
    if (status !== 'connected') {
      console.log('✅ Connection restored')
      setStatus('connected')
      setAppStatus(prev => ({
        ...prev,
        disconnectReason: undefined
      }))
    }
  }

  // Realtime subscription setup
  useEffect(() => {
    let eventSource: EventSource | null = null
    let retryTimeout: NodeJS.Timeout | null = null
    let heartbeatTimeout: NodeJS.Timeout | null = null

    const setupRealtimeConnection = () => {
      console.log('🔄 Setting up realtime connection...')
      
      // Server-Sent Events for realtime app status updates
      eventSource = new EventSource('/api/app-status-stream')
      
      // Reset heartbeat timeout
      const resetHeartbeat = () => {
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
        heartbeatTimeout = setTimeout(() => {
          console.log('💔 Heartbeat timeout - no data received in 20 seconds')
          consecutiveErrorsRef.current += 1
          if (consecutiveErrorsRef.current >= 2) {
            handleDisconnect('Connection timeout', false)
          }
        }, 20000) // 20 second timeout (reduced from 30)
      }

      eventSource.onopen = () => {
        console.log('✅ Realtime connection established')
        handleConnect()
        resetHeartbeat()
      }

      eventSource.onmessage = (event) => {
        resetHeartbeat() // Reset timeout on any message
        
        try {
          const data = JSON.parse(event.data)
          console.log('📨 Received realtime data:', data.type)
          
          if (data.type === 'app_status_update') {
            setAppStatus({
              isActive: data.status.isActive,
              reason: data.status.reason,
              lastChecked: new Date(),
              disconnectReason: data.status.isActive ? undefined : data.status.reason
            })
            
            if (!data.status.isActive) {
              // App actually inactive - force disconnect
              handleDisconnect(data.status.reason || 'App is inactive', true)
            } else {
              handleConnect()
            }
          } else if (data.type === 'connection_established') {
            console.log('✅ Realtime connection confirmed')
            handleConnect()
          } else if (data.type === 'connection_error') {
            console.warn('⚠️ App status check error:', data.message)
            consecutiveErrorsRef.current += 1
            if (consecutiveErrorsRef.current >= 3) {
              handleDisconnect('Repeated status check errors', false)
            }
          } else if (data.type === 'heartbeat') {
            // Legacy heartbeat support
            handleConnect()
            setAppStatus(prev => ({ 
              ...prev, 
              lastChecked: new Date()
            }))
          }
        } catch (error) {
          console.error('Error parsing realtime data:', error)
          consecutiveErrorsRef.current += 1
        }
      }

      eventSource.onerror = (error) => {
        console.log('❌ Realtime connection error, will retry...', error)
        
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
        
        if (eventSource) {
          eventSource.close()
        }
        
        consecutiveErrorsRef.current += 1
        
        // Only show disconnect for persistent errors
        if (consecutiveErrorsRef.current >= 2) {
          handleDisconnect('Realtime connection lost', false)
        }
        
        // Retry connection with exponential backoff
        const retryDelay = Math.min(3000 * Math.pow(1.5, consecutiveErrorsRef.current - 1), 15000)
        console.log(`🔄 Retrying connection in ${retryDelay}ms (attempt ${consecutiveErrorsRef.current})`)
        
        retryTimeout = setTimeout(setupRealtimeConnection, retryDelay)
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
      if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout)
      }
    }
  }, [isOnline])

  // App status check function (for manual retry)
  const checkConnection = async () => {
    console.log('🔍 Starting connection check...')
    
    if (!isOnline) {
      console.log('❌ Network offline, forcing disconnect')
      handleDisconnect('Network offline', true)
      return
    }

    setStatus('checking')
    console.log('⏳ Connection status set to checking...')

    try {
      // Test basic connectivity through API proxy
      console.log('🏥 Testing health endpoint...')
      const connectivityTest = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout (reduced)
      })

      if (!connectivityTest.ok) {
        console.log('❌ Health check failed:', connectivityTest.status)
        handleDisconnect('Health check failed', false)
        return
      }

      console.log('✅ Health check passed')

      // Check app status - önce realtime olmayan direct check yapalım
      try {
        console.log('📋 Checking app status...')
        const appStatusResponse = await fetch('/api/app-control', {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000), // 5 second timeout (reduced)
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (appStatusResponse.status === 503) {
          // App is inactive - force disconnect
          console.log('🔴 App is inactive (503)')
          const errorData = await appStatusResponse.json()
          setAppStatus({
            isActive: false,
            reason: errorData.reason,
            lastChecked: new Date(),
            disconnectReason: errorData.reason
          })
          handleDisconnect(errorData.reason || 'App is inactive', true)
          return
        } else if (appStatusResponse.ok) {
          console.log('✅ App status check successful')
          const data = await appStatusResponse.json()
          setAppStatus({
            isActive: data.status.isActive,
            reason: data.status.reason,
            lastChecked: new Date(),
            disconnectReason: data.status.isActive ? undefined : data.status.reason
          })
          
          if (!data.status.isActive) {
            console.log('🔴 App is inactive per status check')
            handleDisconnect(data.status.reason || 'App is inactive', true)
          } else {
            console.log('✅ App is active, connecting...')
            handleConnect()
          }
          return
        } else {
          console.warn('⚠️ Unexpected app status response:', appStatusResponse.status)
          // Fall through to basic connectivity success
        }
      } catch (error) {
        console.warn('⚠️ App status check failed, continuing with basic connectivity:', error)
        // Fall through to basic connectivity success
      }

      // If we reach here, basic connectivity is working
      console.log('✅ Basic connectivity confirmed, setting connected')
      handleConnect()
      setAppStatus(prev => ({ 
        ...prev, 
        lastChecked: new Date()
      }))

    } catch (error) {
      console.error('❌ Connection check failed:', error)
      handleDisconnect('Connection check failed', false)
    }
  }

  // Retry connection
  const retryConnection = () => {
    consecutiveErrorsRef.current = 0 // Reset error count on manual retry
    checkConnection()
  }

  // Initial connection check (only once)
  useEffect(() => {
    // DEBUG: Bypass initial check for immediate connection
    const BYPASS_INITIAL_CHECK = true
    
    if (BYPASS_INITIAL_CHECK) {
      console.log('🚀 BYPASSING initial check - connecting immediately')
      setStatus('connected')
      setAppStatus(prev => ({
        ...prev,
        isActive: true,
        lastChecked: new Date()
      }))
      return
    }
    
    // Delay initial check to let the app settle
    const timer = setTimeout(() => {
      console.log('🚀 Running initial connection check...')
      checkConnection()
    }, 1000) // 1 second delay

    return () => clearTimeout(timer)
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
            const errorData = await response.json().catch(() => ({ reason: 'App is inactive' }))
            setAppStatus(prev => ({
              ...prev,
              isActive: false,
              disconnectReason: errorData.reason || 'App is inactive'
            }))
            handleDisconnect(errorData.reason || 'App is inactive', true)
          }
        }
        
        return response
      } catch (error) {
        // Network error - check if offline
        if (!navigator.onLine) {
          handleDisconnect('Network error', true)
        }
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current)
      }
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