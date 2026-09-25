import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ClientDetail from "@/components/ClientDetail";
import type { LeadRow, Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as AppRole;
  const hasAccess = role === "admin" || role === "manager" || role === "vanzari";
  if (!hasAccess) redirect("/clienti");

  const [{ data: lead }, { data: owners }, { data: notifications }] = await Promise.all([
    supabase.from("leads").select("*, owner:profiles(id, full_name, initials)").eq("id", id).single(),
    supabase.from("profiles").select("id, full_name, initials").order("full_name"),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!lead) notFound();

  return (
    <AppShell
      actualRole={role}
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
        canEdit={hasAccess}
        canDelete={role === "admin" || role === "manager"}
      />
    </AppShell>
  );
}
