import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PipelineBoard, { type LeadRow, type Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  console.log(
    "[dashboard-page]",
    "error=",
    error ? { name: error.name, message: error.message, status: error.status } : null,
    "user=",
    user ? user.id : user,
  );
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const [{ data: leads }, { data: owners }, { data: notifications }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, owner:profiles(id, full_name, initials)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, initials").order("full_name"),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const role = profile.role as AppRole;

  const shell = (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="dashboard"
      title="Pipeline & Dashboard"
      subtitle="Vânzări"
      notifications={notifications ?? []}
    >
      {role === "editor" ? (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău (Editor) nu are acces la Pipeline & Clienți — vezi matricea de permisiuni din
          Setări. Canalul tău de editor vine într-o iterație viitoare.
        </div>
      ) : (
        <PipelineBoard initialLeads={(leads ?? []) as LeadRow[]} owners={(owners ?? []) as Owner[]} />
      )}
    </AppShell>
  );

  return shell;
}
