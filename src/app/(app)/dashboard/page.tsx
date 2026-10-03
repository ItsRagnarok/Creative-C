import PipelineBoard, { type LeadRow, type Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_SELECT } from "@/lib/selects";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const { supabase, user, role, team } = await getAppContext();
  const owners = team;

  const { data: leads } =
    role === "editor"
      ? { data: null }
      : await supabase.from("leads").select(OWNER_SELECT).order("created_at", { ascending: false });

  return (
    <>
      {role === "editor" ? (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău (Editor) nu are acces la Pipeline & Clienți — vezi matricea de permisiuni din
          Setări. Ai acces la Canalul tău de editor.
        </div>
      ) : (
        <PipelineBoard
          initialLeads={(leads ?? []) as LeadRow[]}
          owners={(owners ?? []) as Owner[]}
          canDelete={role === "admin" || role === "manager"}
          editors={team.filter((p) => p.role === "editor").map((p) => ({ id: p.id, full_name: p.full_name }))}
          currentUserId={user.id}
          startAsClient={client === "1"}
        />
      )}
    </>
  );
}
