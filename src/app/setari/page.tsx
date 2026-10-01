import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { NAV, ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";

const ALL_ROLES: AppRole[] = ["admin", "manager", "vanzari", "editor"];

export default async function SetariPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as AppRole;
  const hasAccess = role === "admin";

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20);

  const items = NAV.flatMap((g) => g.items);
  const { count: teamCount } = hasAccess
    ? await supabase.from("profiles").select("id", { count: "exact", head: true })
    : { count: null };

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="setari"
      title="Setări & Roluri"
      subtitle="Sistem"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <>
          <div className="page-head">
            <div>
              <h1>Setări & Roluri</h1>
              <p>Matricea de permisiuni e generată direct din configurația meniului — mereu la zi, nu poate să rămână în urmă.</p>
            </div>
          </div>

          <div className="grid g-3" style={{ marginBottom: 24 }}>
            {ALL_ROLES.map((r) => (
              <div key={r} className="card">
                <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>{ROLE_LABEL[r]}</h3>
                <p style={{ fontSize: 12 }}>{ROLE_NOTE[r]}</p>
              </div>
            ))}
          </div>

          <div className="section-title"><h2>Matrice de permisiuni</h2></div>
          <div className="card" style={{ padding: 0, marginBottom: 24, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Meniu</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r} style={{ textAlign: "center" }}>{ROLE_LABEL[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.key}>
                    <td>
                      {item.icon} {item.label}
                      {!item.enabled && <span className="badge" style={{ marginLeft: 8 }}>curând</span>}
                    </td>
                    {ALL_ROLES.map((r) => (
                      <td key={r} style={{ textAlign: "center" }}>
                        {item.roles.includes(r) ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title"><h2>Securitate</h2></div>
          <div className="grid g-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <h3 style={{ fontSize: 13.5 }}>Rolul e protejat la nivel de bază de date</h3>
              <p style={{ fontSize: 12 }}>
                Niciun cont nu-și poate schimba singur rolul — există o regulă la nivel de bază de date
                (nu doar în interfață) care blochează orice încercare, indiferent pe unde ar veni cererea.
                Doar un Admin poate schimba rolul altui cont, din Echipă.
              </p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 13.5 }}>Conturi active</h3>
              <p style={{ fontSize: 12 }}>
                {teamCount ?? "—"} conturi în platformă. Gestionarea lor (invitare, schimbare rol, ștergere)
                se face din <a href="/echipa">Echipă</a>.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({ROLE_LABEL[role]}) nu are acces la Setări & Roluri — exclusiv pentru Admin.
        </div>
      )}
    </AppShell>
  );
}
