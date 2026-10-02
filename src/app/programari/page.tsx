import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BookingsBoard, { type BookingRow, type CalendarExtra } from "@/components/BookingsBoard";
import type { AvailabilityRow } from "@/components/WorkScheduleModal";
import BookingAdminTools, { type SlugRow, type PriorityList, type PriorityItem } from "@/components/BookingAdminTools";
import type { Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";
import { loadAccess } from "@/lib/access";

export default async function ProgramariPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profiles?.find((p) => p.id === user.id) ?? null;
  if (!profile) redirect("/login");
  const owners = profiles ?? [];

  const role = profile.role as AppRole;
  const access = await loadAccess(supabase, role);
  const hasAccess = access.programari.view;

  // Wide enough for the calendar's week-back/week-forward navigation, not
  // just "from now on" — otherwise earlier days in the *current* week
  // (already past) silently vanish from their own week view.
  // eslint-disable-next-line react-hooks/purity -- server-rendered per request anyway (cookies() forces dynamic rendering)
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
  // eslint-disable-next-line react-hooks/purity
  const until = new Date(Date.now() + 35 * 86_400_000).toISOString();

  const canSeeEverything = role === "admin" || role === "manager";
  const [{ data: bookings }, { data: projectDeadlines }, { data: documentExpiries }, { data: invoiceDueDates }, { data: availability }, { data: slugRows }, { data: priorityLists }, { data: priorityItems }] = await Promise.all([
    hasAccess
      ? supabase
          .from("bookings")
          .select("*, owner:profiles!bookings_owner_id_fkey(id, full_name, initials), link:booking_links(link_owner:profiles!booking_links_link_owner_id_fkey(id, full_name, initials))")
          .gte("scheduled_at", since)
          .lt("scheduled_at", until)
          .order("scheduled_at", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: null }),
    canSeeEverything
      ? supabase
          .from("projects")
          .select("id, title, deadline")
          .neq("stage", "finalizat")
          .gte("deadline", since)
          .lt("deadline", until)
      : Promise.resolve({ data: null }),
    canSeeEverything
      ? supabase
          .from("documents")
          .select("id, title, expiry_date")
          .eq("status", "semnat")
          .gte("expiry_date", since)
          .lt("expiry_date", until)
      : Promise.resolve({ data: null }),
    canSeeEverything
      ? supabase
          .from("invoices")
          .select("id, number, amount, due_date, lead:leads(name)")
          .in("status", ["neplatita", "restanta"])
          .gte("due_date", since)
          .lt("due_date", until)
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("availability").select("*") : Promise.resolve({ data: null }),
    profile.is_super_admin ? supabase.from("booking_slugs").select("slug, owner_id") : Promise.resolve({ data: null }),
    profile.is_super_admin ? supabase.from("booking_priority_lists").select("id, name, active").order("created_at") : Promise.resolve({ data: null }),
    profile.is_super_admin ? supabase.from("booking_priority_items").select("list_id, user_id, position") : Promise.resolve({ data: null }),
  ]);

  const extraEvents: CalendarExtra[] = [
    ...(projectDeadlines ?? []).map((p) => ({ id: `proj-${p.id}`, date: p.deadline as string, label: `Deadline proiect: ${p.title}`, kind: "deadline" as const, href: "/proiecte" })),
    ...(documentExpiries ?? []).map((d) => ({ id: `doc-${d.id}`, date: d.expiry_date as string, label: `Expiră contract: ${d.title}`, kind: "document" as const, href: "/documente" })),
    ...(invoiceDueDates ?? []).map((i) => ({
      id: `inv-${i.id}`,
      date: i.due_date as string,
      label: `Factură scadentă: ${new Intl.NumberFormat("ro-RO").format(Number(i.amount))} lei${i.lead ? ` — ${i.lead.name}` : ` (${i.number})`}`,
      kind: "invoice" as const,
      href: "/financiar",
    })),
  ];

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
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
          isAdmin={role === "admin"}
          userId={user.id}
          adminTools={
            profile.is_super_admin ? (
              <BookingAdminTools
                team={(profiles ?? []).filter((p) => p.role === "admin" || p.role === "manager" || p.role === "vanzari").map((p) => ({ id: p.id, full_name: p.full_name }))}
                initialSlugs={(slugRows ?? []) as SlugRow[]}
                initialLists={(priorityLists ?? []) as PriorityList[]}
                initialItems={(priorityItems ?? []) as PriorityItem[]}
              />
            ) : null
          }
          myAvailability={((availability ?? []) as AvailabilityRow[]).filter((r) => r.user_id === user.id)}
          extraEvents={extraEvents}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău nu are acces la Programări — vezi matricea de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
