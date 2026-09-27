import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import FinanciarBoard, { type InvoiceRow } from "@/components/FinanciarBoard";
import type { Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

export default async function FinanciarPage() {
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
  const hasAccess = role === "admin" || role === "manager";

  const [{ data: invoices }, { data: leads }, { data: documents }, { data: owners }, { data: notifications }] = await Promise.all([
    hasAccess
      ? supabase
          .from("invoices")
          .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
          .order("issue_date", { ascending: false })
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("documents").select("id, title, lead_id, value_total").order("title") : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name, initials").order("full_name"),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="financiar"
      title="Financiar"
      subtitle="Business"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <FinanciarBoard
          initialInvoices={(invoices ?? []) as InvoiceRow[]}
          leads={(leads ?? []) as { id: string; name: string }[]}
          documents={(documents ?? []) as { id: string; title: string; lead_id: string | null; value_total: number | null }[]}
          owners={(owners ?? []) as Owner[]}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Vânzări" : role}) nu are acces la Financiar — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
