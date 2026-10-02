import EmailAdmin, { type TemplateRow, type OutboxRow, type ClientContact } from "@/components/EmailAdmin";
import { getAppContext } from "@/lib/app-context";

export default async function EmailPage() {
  const { supabase, user, profile, team } = await getAppContext();
  const isSuper = !!profile.is_super_admin;

  const [{ data: templates }, { data: outbox }, { data: bookingContacts }] = isSuper
    ? await Promise.all([
        supabase.from("email_templates").select("*").order("position"),
        supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("bookings").select("name, email, scheduled_at").not("email", "is", null).order("scheduled_at", { ascending: false }).limit(1000),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  // One client per email address (latest name wins).
  const seen = new Map<string, ClientContact>();
  for (const b of bookingContacts ?? []) {
    const email = (b.email ?? "").trim().toLowerCase();
    if (email && !seen.has(email)) seen.set(email, { email, name: b.name });
  }

  return (
    <>
      {isSuper ? (
        <EmailAdmin
          initialTemplates={(templates ?? []) as TemplateRow[]}
          initialOutbox={(outbox ?? []) as OutboxRow[]}
          clients={Array.from(seen.values())}
          team={team.map((t) => ({ id: t.id, full_name: t.full_name, role: t.role }))}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Secțiunea Email este exclusiv pentru Admin S.
        </div>
      )}
    </>
  );
}
