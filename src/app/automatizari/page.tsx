import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AutomationsBoard, { type AutomationRuleRow, type AutomationLogRow } from "@/components/AutomationsBoard";
import type { AppRole } from "@/lib/roles";
import { accessRequest, resolveAccess } from "@/lib/access";

export default async function AutomatizariPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const accessReq = accessRequest(supabase);

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
  const access = resolveAccess((await accessReq).data, role);
  const hasAccess = access.automatizari.view;

  const [{ data: rules }, { data: log }] = await Promise.all([
    hasAccess ? supabase.from("automation_rules").select("*").order("kind") : Promise.resolve({ data: null }),
    hasAccess
      ? supabase.from("automation_log").select("*").order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="automatizari"
      title="Automatizări"
      subtitle="Business"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <AutomationsBoard
          initialRules={(rules ?? []) as AutomationRuleRow[]}
          initialLog={(log ?? []) as AutomationLogRow[]}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Automatizări — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
