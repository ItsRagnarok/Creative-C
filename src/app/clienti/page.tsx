import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ClientsTable from "@/components/ClientsTable";
import type { LeadRow } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

export default async function ClientiPage() {
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

  const { data: leads } = hasAccess
    ? await supabase
        .from("leads")
        .select("*, owner:profiles(id, full_name, initials)")
        .order("created_at", { ascending: false })
    : { data: null };

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
      activeKey="clienti"
      title="Clienți"
      subtitle="Vânzări"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <ClientsTable initialLeads={(leads ?? []) as LeadRow[]} />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "editor" ? "Editor" : role}) nu are acces la Clienți — vezi matricea de
          permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
