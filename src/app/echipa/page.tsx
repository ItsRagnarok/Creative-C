import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import EchipaBoard, { type ProfileRow } from "@/components/EchipaBoard";
import type { AppRole } from "@/lib/roles";
import { loadAccess } from "@/lib/access";

export default async function EchipaPage() {
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
  const hasAccess = access.echipa.view;

  const { data: profiles } = hasAccess
    ? await supabase.from("profiles").select("*").order("created_at", { ascending: true })
    : { data: null };

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="echipa"
      title="Echipă"
      subtitle="Livrare"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <EchipaBoard
          initialProfiles={(profiles ?? []) as ProfileRow[]}
          canManage={role === "admin"}
          currentIsSuper={!!profile.is_super_admin}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Echipă — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
