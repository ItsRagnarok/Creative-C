import GuideView from "@/components/GuideView";
import { getAppContext } from "@/lib/app-context";

export default async function Page() {
  const { supabase, role, access } = await getAppContext();
  if (!access.editori.view) {
    return <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>Contul tău nu are acces la acest ghid.</div>;
  }
  const { data } = await supabase.from("guides").select("*").eq("slug", "regulament").maybeSingle();
  return (
    <GuideView
      slug="regulament"
      title={data?.title ?? ""}
      initialBody={data?.body ?? ""}
      canEdit={(role === "admin" || role === "manager") && access.editori.edit}
    />
  );
}
