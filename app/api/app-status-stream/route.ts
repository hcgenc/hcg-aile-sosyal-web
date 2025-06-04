// REALTIME APP STATUS STREAM
// Server-Sent Events for anlık app durum takibi

import { NextRequest } from 'next/server'
import { checkAppStatus } from '@/lib/app-control'

export async function GET(request: NextRequest) {
  // Check if client accepts Server-Sent Events
  const accept = request.headers.get('accept')
  if (!accept?.includes('text/event-stream')) {
    return new Response('This endpoint requires SSE support', { status: 400 })
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let statusInterval: NodeJS.Timeout
      let heartbeatInterval: NodeJS.Timeout
      let isActive = true

      // Send heartbeat every 15 seconds
      const sendHeartbeat = () => {
        if (!isActive) return

        try {
          const data = JSON.stringify({
            type: 'heartbeat',
            message: 'Connection alive',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(`data: ${data}\n\n`)
        } catch (error) {
          console.error('Error sending heartbeat:', error)
        }
      }

      // Send status update
      const sendStatusUpdate = async () => {
        if (!isActive) return

        try {
          // Get current app status
          const status = await checkAppStatus()
          
          // Send status update
          const data = JSON.stringify({
            type: 'app_status_update',
            status: {
              isActive: status.isActive,
              reason: status.reason,
              updatedAt: status.updatedAt,
              updatedBy: status.updatedBy
            },
            timestamp: new Date().toISOString()
          })

          controller.enqueue(`data: ${data}\n\n`)
        } catch (error) {
          console.error('Error in SSE status check:', error)
          
          // Send error status but don't break the connection
          const errorData = JSON.stringify({
            type: 'connection_error',
            message: 'Status check temporarily failed',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(`data: ${errorData}\n\n`)
        }
      }

      // Send connection established message
      const sendConnectionEstablished = () => {
        const data = JSON.stringify({
          type: 'connection_established',
          message: 'Realtime connection active',
          timestamp: new Date().toISOString()
        })
        controller.enqueue(`data: ${data}\n\n`)
      }

      // Send immediate status update when connection is established
      const initialize = async () => {
        try {
          sendConnectionEstablished()
          await sendStatusUpdate() // İlk bağlantıda hemen status gönder
        } catch (error) {
          console.error('Error initializing SSE connection:', error)
        }
      }

      // Initialize connection
      initialize()

      // Set up intervals
      heartbeatInterval = setInterval(sendHeartbeat, 15000) // 15 seconds heartbeat
      statusInterval = setInterval(sendStatusUpdate, 30000) // 30 seconds status check

      // Handle client disconnect
      const cleanup = () => {
        isActive = false
        if (statusInterval) clearInterval(statusInterval)
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        try {
          controller.close()
        } catch (error) {
          // Connection already closed
        }
      }

      // Listen for client disconnect
      request.signal?.addEventListener('abort', cleanup)

      // Set up cleanup timeout as fallback (5 minutes)
      setTimeout(() => {
        if (isActive) {
          console.log('SSE connection timeout after 5 minutes')
          cleanup()
        }
      }, 5 * 60 * 1000)
    }
  })

  // Return SSE response with improved headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
} 