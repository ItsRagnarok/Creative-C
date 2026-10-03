import ClientsTable from "@/components/ClientsTable";
import type { LeadRow } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_SELECT } from "@/lib/selects";

export default async function ClientiPage() {
  const { supabase, role, access, team } = await getAppContext();
  const hasAccess = access.clienti.view;

  const { data: leads } = hasAccess
    ? await supabase
        .from("leads")
        .select(OWNER_SELECT)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <>
      {hasAccess ? (
        <ClientsTable
          initialLeads={(leads ?? []) as LeadRow[]}
          canDelete={role === "admin" || role === "manager"}
          canEdit={access.clienti.edit}
          editors={team.filter((p) => p.role === "editor").map((p) => ({ id: p.id, full_name: p.full_name }))}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "editor" ? "Editor" : role}) nu are acces la Clienți — vezi matricea de
          permisiuni din Setări.
        </div>
      )}
    </>
  );
}
