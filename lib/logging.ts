import { supabaseProxy } from "@/lib/supabase-proxy"

export async function logUserAction(userId: string, username: string, action: string, details?: string) {
  try {
    const result = await supabaseProxy.insert("logs", {
      user_id: userId,
      username,
      action,
      details,
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })

    if (result.error) {
      console.error("Error logging action:", result.error)
    }
  } catch (error) {
    console.error("Error logging action:", error)
  }
}
