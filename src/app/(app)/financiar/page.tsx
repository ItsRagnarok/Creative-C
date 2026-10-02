import FinanciarBoard, { type InvoiceRow } from "@/components/FinanciarBoard";
import type { Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_LEAD_SELECT } from "@/lib/selects";

export default async function FinanciarPage() {
  const { supabase, role, access, team } = await getAppContext();
  const owners = team;
  const hasAccess = access.financiar.view;

  const [{ data: invoices }, { data: leads }, { data: documents }] = await Promise.all([
    hasAccess
      ? supabase
          .from("invoices")
          .select(OWNER_LEAD_SELECT)
          .order("issue_date", { ascending: false })
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("documents").select("id, title, lead_id, value_total").order("title") : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      {hasAccess ? (
        <FinanciarBoard
          initialInvoices={(invoices ?? []) as InvoiceRow[]}
          leads={(leads ?? []) as { id: string; name: string }[]}
          documents={(documents ?? []) as { id: string; title: string; lead_id: string | null; value_total: number | null }[]}
          owners={(owners ?? []) as Owner[]}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Financiar — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </>
  );
}
