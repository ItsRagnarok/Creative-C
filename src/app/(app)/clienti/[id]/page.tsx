import { notFound, redirect } from "next/navigation";
import ClientDetail from "@/components/ClientDetail";
import type { LeadRow, Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_SELECT } from "@/lib/selects";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, role, access, team } = await getAppContext();
  const owners = team;
  const hasAccess = access.clienti.view;
  if (!hasAccess) redirect("/clienti");

  const { data: lead } = await supabase.from("leads").select(OWNER_SELECT).eq("id", id).single();
  if (!lead) notFound();

  return (
    <>
      <ClientDetail
        lead={lead as LeadRow}
        owners={(owners ?? []) as Owner[]}
        canEdit={access.clienti.edit}
        canDelete={role === "admin" || role === "manager"}
      />
    </>
  );
}
