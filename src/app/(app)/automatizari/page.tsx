import AutomationsBoard, { type AutomationRuleRow, type AutomationLogRow } from "@/components/AutomationsBoard";
import { getAppContext } from "@/lib/app-context";

export default async function AutomatizariPage() {
  const { supabase, role, access } = await getAppContext();
  const hasAccess = access.automatizari.view;

  const [{ data: rules }, { data: log }] = await Promise.all([
    hasAccess ? supabase.from("automation_rules").select("*").order("kind") : Promise.resolve({ data: null }),
    hasAccess
      ? supabase.from("automation_log").select("*").order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
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
    </>
  );
}
