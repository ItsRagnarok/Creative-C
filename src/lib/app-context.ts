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
  // The proxy only checks that a session cookie exists; this is the real validation. A revoked/expired/orphaned
  // session lands on /login?reauth=1, where the proxy clears the stale cookies (otherwise /login would bounce
  // straight back to the app, forever).
  if (!user) redirect("/login?reauth=1");

  const [{ data: teamRows }, accessRes] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    accessRequest(supabase),
  ]);
  const team = teamRows ?? [];
  const profile = team.find((p) => p.id === user.id);
  if (!profile) redirect("/login?reauth=1");

  const role = profile.role as AppRole;
  return { supabase, user, profile, team, role, access: resolveAccess(accessRes.data, role) };
});
