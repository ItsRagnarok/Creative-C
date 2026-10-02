import DocumentsBoard, { type DocumentRow } from "@/components/DocumentsBoard";
import type { Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_LEAD_SELECT } from "@/lib/selects";

export default async function DocumentePage() {
  const { supabase, role, access, team } = await getAppContext();
  const owners = team;
  const hasAccess = access.documente.view;

  const [{ data: documents }, { data: leads }] = await Promise.all([
    hasAccess
      ? supabase
          .from("documents")
          .select(OWNER_LEAD_SELECT)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      {hasAccess ? (
        <DocumentsBoard
          initialDocuments={(documents ?? []) as DocumentRow[]}
          leads={(leads ?? []) as { id: string; name: string }[]}
          owners={(owners ?? []) as Owner[]}
          canEdit={access.documente.edit}
          canDelete={role === "admin" || role === "manager"}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "editor" ? "Editor" : role}) nu are acces la Documente & Contracte — vezi
          matricea de permisiuni din Setări.
        </div>
      )}
    </>
  );
}
