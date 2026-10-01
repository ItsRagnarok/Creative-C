import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PortalClientBoard, { type ClientOption, type PortalProjectRow, type PortalDocumentRow, type PortalInvoiceRow } from "@/components/PortalClientBoard";
import type { AppRole } from "@/lib/roles";

export default async function PortalClientPage() {
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
  const hasAccess = role === "admin" || role === "manager";

  const [{ data: leads }, { data: projects }, { data: documents }, { data: invoices }] = await Promise.all([
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("projects").select("id, title, lead_id, stage, deadline").order("deadline", { ascending: true, nullsFirst: false }) : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("documents").select("id, title, lead_id, type, status, expiry_date").order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("invoices").select("id, number, lead_id, amount, status, due_date").order("due_date", { ascending: true, nullsFirst: false }) : Promise.resolve({ data: null }),
  ]);

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="portal"
      title="Portal client (preview)"
      subtitle="Vitrine"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <PortalClientBoard
          clients={(leads ?? []) as ClientOption[]}
          projects={(projects ?? []) as PortalProjectRow[]}
          documents={(documents ?? []) as PortalDocumentRow[]}
          invoices={(invoices ?? []) as PortalInvoiceRow[]}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Vânzări" : role}) nu are acces la Portal client — vezi
          matricea de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
