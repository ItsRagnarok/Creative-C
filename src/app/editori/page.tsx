import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ChannelsBoard, {
  type ChannelRow,
  type MessageRow,
  type DailyStatusRow,
  type ClipStockRow,
} from "@/components/ChannelsBoard";
import EditoriTabs from "@/components/EditoriTabs";
import EditorCards from "@/components/EditorCards";
import ContentCalendar, { type CalendarEditor } from "@/components/ContentCalendar";
import type { AppRole } from "@/lib/roles";
import { accessRequest, resolveAccess } from "@/lib/access";
import { MESSAGE_SELECT } from "@/lib/selects";

export default async function EditoriPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const accessReq = accessRequest(supabase);

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
  const access = resolveAccess((await accessReq).data, role);
  const hasAccess = access.editori.view;
  const today = new Date().toISOString().slice(0, 10);

  const isManager = role === "admin" || role === "manager";
  const [{ data: channels }, { data: messages }, { data: statuses }, { data: stock }, { data: editorProfiles }] = await Promise.all([
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
          .select(MESSAGE_SELECT)
          .order("created_at", { ascending: false })
          .limit(400)
      : Promise.resolve({ data: null }),
    hasAccess
      ? supabase
          .from("editor_daily_status")
          .select("*, editor:profiles(id, full_name, initials)")
          .eq("status_date", today)
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("editor_clip_stock").select("*") : Promise.resolve({ data: null }),
    // Managers see every editor's calendar; an editor only ever gets their own.
    isManager
      ? supabase.from("profiles").select("id, full_name, initials, role").order("full_name")
      : Promise.resolve({ data: [{ id: user.id, full_name: profile.full_name, initials: profile.initials, role: profile.role }] }),
  ]);

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="editori"
      title="Canale"
      subtitle="Livrare"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <EditoriTabs
          defaultTab={role === "editor" ? "calendar" : "chat"}
          chat={
            <ChannelsBoard
              channels={(channels ?? []) as ChannelRow[]}
              initialMessages={((messages ?? []) as MessageRow[]).slice().reverse()}
              initialStatuses={(statuses ?? []) as DailyStatusRow[]}
              initialStock={(stock ?? []) as ClipStockRow[]}
              canManage={isManager}
              currentUserId={user.id}
            />
          }
          calendar={
            <ContentCalendar
              editors={((editorProfiles ?? []) as CalendarEditor[]).filter((p) => p.role === "editor")}
              canManage={isManager}
              currentUserId={user.id}
            />
          }
          cards={
            <EditorCards
              editors={(editorProfiles ?? []) as CalendarEditor[]}
              canManage={isManager}
              canGive={role === "admin"}
              isSuper={!!profile.is_super_admin}
              currentUserId={user.id}
            />
          }
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Canale — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
