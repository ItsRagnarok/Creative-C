import BookingsBoard, { type BookingRow, type CalendarExtra } from "@/components/BookingsBoard";
import type { AvailabilityRow, GeneralRow } from "@/components/WorkScheduleModal";
import BookingAdminTools, { type SlugRow, type BookingSettings } from "@/components/BookingAdminTools";
import type { Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { BOOKING_SELECT } from "@/lib/selects";

export default async function ProgramariPage() {
  const { supabase, user, profile, team, role, access } = await getAppContext();
  const owners = team;
  const hasAccess = access.programari.view;

  // Wide enough for the calendar's week-back/week-forward navigation, not
  // just "from now on" — otherwise earlier days in the *current* week
  // (already past) silently vanish from their own week view.
  // eslint-disable-next-line react-hooks/purity -- server-rendered per request anyway (cookies() forces dynamic rendering)
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
  // eslint-disable-next-line react-hooks/purity
  const until = new Date(Date.now() + 35 * 86_400_000).toISOString();

  const canSeeEverything = role === "admin" || role === "manager";
  const [{ data: bookings }, { data: projectDeadlines }, { data: documentExpiries }, { data: invoiceDueDates }, { data: availability }, { data: slugRows }, { data: settingsRow }, { data: mySlugRow }, { data: generalRows }] = await Promise.all([
    hasAccess
      ? supabase
          .from("bookings")
          .select(BOOKING_SELECT)
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
    profile.is_super_admin ? supabase.from("booking_settings").select("priority_user_id, priority_enabled").maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("booking_slugs").select("slug").eq("owner_id", user.id).maybeSingle(),
    profile.is_super_admin ? supabase.from("general_availability").select("*") : Promise.resolve({ data: null }),
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
    <>
      {hasAccess ? (
        <BookingsBoard
          initialBookings={(bookings ?? []) as BookingRow[]}
          owners={(owners ?? []) as Owner[]}
          canDelete={role === "admin" || role === "manager"}
          isAdmin={role === "admin"}
          userId={user.id}
          canUseGeneralLink={role === "admin" || role === "vanzari"}
          myLinkSlug={mySlugRow?.slug ?? null}
          generalAvailability={profile.is_super_admin ? ((generalRows ?? []) as GeneralRow[]) : null}
          adminTools={
            profile.is_super_admin ? (
              <BookingAdminTools
                team={team.filter((p) => p.role === "admin" || p.role === "manager" || p.role === "vanzari").map((p) => ({ id: p.id, full_name: p.full_name, role: p.role }))}
                initialSlugs={(slugRows ?? []) as SlugRow[]}
                initialSettings={(settingsRow ?? { priority_user_id: null, priority_enabled: false }) as BookingSettings}
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
    </>
  );
}
