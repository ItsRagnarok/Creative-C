import { NAV, ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";
import { getAppContext } from "@/lib/app-context";
import AccessMatrix, { type AccessRow, type AccessUser } from "@/components/AccessMatrix";

const ALL_ROLES: AppRole[] = ["admin", "manager", "vanzari", "editor"];

export default async function SetariPage() {
  const { supabase, profile, role } = await getAppContext();
  const hasAccess = !!profile.is_super_admin;

  const items = NAV.flatMap((g) => g.items);
  const { count: teamCount } = hasAccess
    ? await supabase.from("profiles").select("id", { count: "exact", head: true })
    : { count: null };
  const [{ data: accessUsers }, { data: accessRows }] = hasAccess
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, role, is_super_admin").eq("is_super_admin", false).order("full_name"),
        supabase.from("user_access").select("user_id, menu, can_view, can_edit"),
      ])
    : [{ data: null }, { data: null }];

  return (
    <>
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

          <div className="section-title"><h2>Acces per utilizator</h2></div>
          <AccessMatrix users={(accessUsers ?? []) as AccessUser[]} initialRows={(accessRows ?? []) as AccessRow[]} />

          <div className="section-title"><h2>Matrice de permisiuni (implicit, pe roluri)</h2></div>
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
    </>
  );
}
