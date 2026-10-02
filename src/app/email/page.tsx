import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import EmailAdmin, { type TemplateRow, type OutboxRow, type ClientContact } from "@/components/EmailAdmin";
import type { AppRole } from "@/lib/roles";
import { loadAccess } from "@/lib/access";

export default async function EmailPage() {
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
  const access = await loadAccess(supabase, role);
  const isSuper = !!profile.is_super_admin;

  const [{ data: templates }, { data: outbox }, { data: bookingContacts }, { data: team }] = isSuper
    ? await Promise.all([
        supabase.from("email_templates").select("*").order("position"),
        supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("bookings").select("name, email, scheduled_at").not("email", "is", null).order("scheduled_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, full_name, role").order("full_name"),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }];

  // One client per email address (latest name wins).
  const seen = new Map<string, ClientContact>();
  for (const b of bookingContacts ?? []) {
    const email = (b.email ?? "").trim().toLowerCase();
    if (email && !seen.has(email)) seen.set(email, { email, name: b.name });
  }

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={isSuper}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="email"
      title="Email"
      subtitle="Sistem"
      notifications={notifications ?? []}
    >
      {isSuper ? (
        <EmailAdmin
          initialTemplates={(templates ?? []) as TemplateRow[]}
          initialOutbox={(outbox ?? []) as OutboxRow[]}
          clients={Array.from(seen.values())}
          team={(team ?? []).map((t) => ({ id: t.id, full_name: t.full_name, role: t.role }))}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Secțiunea Email este exclusiv pentru Admin S.
        </div>
      )}
    </AppShell>
  );
}
