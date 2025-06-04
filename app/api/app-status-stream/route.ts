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
      let interval: NodeJS.Timeout
      let isActive = true

      // Send heartbeat and status check every 10 seconds
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
          
          // Send error status
          const errorData = JSON.stringify({
            type: 'heartbeat',
            status: 'error',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(`data: ${errorData}\n\n`)
        }
      }

      // Send initial status
      sendStatusUpdate()

      // Set up interval for regular updates
      interval = setInterval(sendStatusUpdate, 10000) // 10 seconds

      // Handle client disconnect
      request.signal?.addEventListener('abort', () => {
        isActive = false
        if (interval) clearInterval(interval)
        controller.close()
      })
    }
  })

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
} 