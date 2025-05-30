import { createSupabaseClient } from "@/lib/supabase-helpers"

export async function logUserAction(userId: string, username: string, action: string, details?: string) {
  try {
    const supabase = createSupabaseClient()

    await supabase.from("logs").insert({
      user_id: userId,
      username,
      action,
      details,
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })
  } catch (error) {
    console.error("Error logging action:", error)
  }
}
