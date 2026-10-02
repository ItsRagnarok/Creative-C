import ProspectsTable, { type ProspectRow } from "@/components/ProspectsTable";
import { getAppContext } from "@/lib/app-context";

export default async function ProspectiPage() {
  const { supabase, role, access } = await getAppContext();
  if (!access.clienti.view) {
    return <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>Contul tău nu are acces la Prospecți.</div>;
  }
  const { data } = await supabase.from("prospects").select("*").order("city").order("name");
  return <ProspectsTable initialRows={(data ?? []) as ProspectRow[]} canDelete={role === "admin" || role === "manager"} />;
}
