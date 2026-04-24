import { createClient } from "@/utils/supabase/client";

export type NotificationType = "new_run" | "new_join" | "reminder";

export async function createNotification(
  userId: string,
  type: NotificationType,
  content: string
) {
  const supabase = createClient();
  
  // 1. Check if user wants notifications
  const { data: user } = await supabase
    .from("users")
    .select("notifications_enabled")
    .eq("id", userId)
    .single();

  if (!user || user.notifications_enabled === false) {
    return; // User disabled notifications
  }

  // 2. Insert into notifications table
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId,
      type,
      content,
    },
  ]);
  
  if (error) {
    console.error("Failed to send notification:", error);
  }
}
