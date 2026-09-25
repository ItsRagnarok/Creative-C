import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BookingsBoard, { type BookingRow } from "@/components/BookingsBoard";
import type { Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

export default async function ProgramariPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as AppRole;
  const hasAccess = role === "admin" || role === "manager" || role === "vanzari";

  // eslint-disable-next-line react-hooks/purity -- server-rendered per request anyway (cookies() forces dynamic rendering)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: bookings } = hasAccess
    ? await supabase
        .from("bookings")
        .select("*, owner:profiles(id, full_name, initials)")
        .gte("scheduled_at", since)
        .order("scheduled_at", { ascending: true })
        .limit(100)
    : { data: null };

  const { data: owners } = await supabase.from("profiles").select("id, full_name, initials").order("full_name");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="programari"
      title="Programări"
      subtitle="Vânzări"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <BookingsBoard
          initialBookings={(bookings ?? []) as BookingRow[]}
          owners={(owners ?? []) as Owner[]}
          canDelete={role === "admin" || role === "manager"}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău nu are acces la Programări — vezi matricea de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
