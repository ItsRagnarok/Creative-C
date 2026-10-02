import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ClientDetail from "@/components/ClientDetail";
import type { LeadRow, Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";
import { loadAccess } from "@/lib/access";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, { data: lead }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("leads").select("*, owner:profiles(id, full_name, initials)").eq("id", id).single(),
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
  const hasAccess = access.clienti.view;
  if (!hasAccess) redirect("/clienti");

  if (!lead) notFound();

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="clienti"
      title={lead.name}
      subtitle="Fișă client"
      notifications={notifications ?? []}
    >
      <ClientDetail
        lead={lead as LeadRow}
        owners={(owners ?? []) as Owner[]}
        canEdit={access.clienti.edit}
        canDelete={role === "admin" || role === "manager"}
      />
    </AppShell>
  );
}
