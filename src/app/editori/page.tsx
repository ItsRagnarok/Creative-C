import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ChannelsBoard, {
  type ChannelRow,
  type MessageRow,
  type DailyStatusRow,
  type ClipStockRow,
} from "@/components/ChannelsBoard";
import type { AppRole } from "@/lib/roles";

export default async function EditoriPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!profile) redirect("/login");

  const role = profile.role as AppRole;
  const hasAccess = role === "admin" || role === "manager" || role === "editor";
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: channels }, { data: messages }, { data: statuses }, { data: stock }] = await Promise.all([
    hasAccess
      ? supabase
          .from("channels")
          .select("*, editor:profiles(id, full_name, initials)")
          .order("kind", { ascending: false })
          .order("slug")
      : Promise.resolve({ data: null }),
    hasAccess
      ? supabase
          .from("channel_messages")
          .select("*, author:profiles(id, full_name, initials)")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
    hasAccess
      ? supabase
          .from("editor_daily_status")
          .select("*, editor:profiles(id, full_name, initials)")
          .eq("status_date", today)
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("editor_clip_stock").select("*") : Promise.resolve({ data: null }),
  ]);

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="editori"
      title="Canale editori"
      subtitle="Livrare"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <ChannelsBoard
          channels={(channels ?? []) as ChannelRow[]}
          initialMessages={(messages ?? []) as MessageRow[]}
          initialStatuses={(statuses ?? []) as DailyStatusRow[]}
          initialStock={(stock ?? []) as ClipStockRow[]}
          canManage={role === "admin" || role === "manager"}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Vânzări" : role}) nu are acces la Canale editori — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
