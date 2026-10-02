import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accessRequest, resolveAccess } from "@/lib/access";
import type { AppRole } from "@/lib/roles";

// Everything a signed-in page needs, loaded in ONE round of parallel queries after the auth check:
// who is signed in, the whole (small) team list, and the effective menu access. cache() shares it between
// the layout and the page within a request, so nothing is fetched twice.
export const getAppContext = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: teamRows }, accessRes] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    accessRequest(supabase),
  ]);
  const team = teamRows ?? [];
  const profile = team.find((p) => p.id === user.id);
  if (!profile) redirect("/login");

  const role = profile.role as AppRole;
  return { supabase, user, profile, team, role, access: resolveAccess(accessRes.data, role) };
});
