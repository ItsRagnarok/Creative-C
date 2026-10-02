import PortalClientBoard, { type ClientOption, type PortalProjectRow, type PortalDocumentRow, type PortalInvoiceRow } from "@/components/PortalClientBoard";
import { getAppContext } from "@/lib/app-context";

export default async function PortalClientPage() {
  const { supabase, role, access } = await getAppContext();
  const hasAccess = access.portal.view;

  const [{ data: leads }, { data: projects }, { data: documents }, { data: invoices }] = await Promise.all([
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("projects").select("id, title, lead_id, stage, deadline").order("deadline", { ascending: true, nullsFirst: false }) : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("documents").select("id, title, lead_id, type, status, expiry_date").order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("invoices").select("id, number, lead_id, amount, status, due_date").order("due_date", { ascending: true, nullsFirst: false }) : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      {hasAccess ? (
        <PortalClientBoard
          clients={(leads ?? []) as ClientOption[]}
          projects={(projects ?? []) as PortalProjectRow[]}
          documents={(documents ?? []) as PortalDocumentRow[]}
          invoices={(invoices ?? []) as PortalInvoiceRow[]}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Portal client — vezi
          matricea de permisiuni din Setări.
        </div>
      )}
    </>
  );
}
