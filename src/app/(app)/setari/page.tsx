import Link from "next/link";
import { NAV, ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";
import { getAppContext } from "@/lib/app-context";
import EchipaBoard, { type ProfileRow } from "@/components/EchipaBoard";
import AccessMatrix, { type AccessRow, type AccessUser } from "@/components/AccessMatrix";

const ALL_ROLES: AppRole[] = ["admin", "manager", "vanzari", "editor"];

export default async function SetariPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const { supabase, user, profile, role, access, team } = await getAppContext();
  const isSuper = !!profile.is_super_admin;
  const canTeam = access.echipa.view;
  // Submenus: "Roluri & acces" (admin S only) and "Echipă" (anyone with the Echipă access).
  const tab: "roluri" | "echipa" = tabParam === "echipa" && canTeam ? "echipa" : isSuper ? "roluri" : "echipa";
  const hasAccess = tab === "roluri" && isSuper;

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

  const tabs = (
    <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
      {isSuper && <Link href="/setari?tab=roluri" className={`btn sm ${tab === "roluri" ? "primary" : "ghost"}`}>Roluri & acces</Link>}
      {canTeam && <Link href="/setari?tab=echipa" className={`btn sm ${tab === "echipa" ? "primary" : "ghost"}`}>Echipă</Link>}
    </div>
  );

  if (tab === "echipa" && canTeam) {
    return (
      <>
        {tabs}
        <EchipaBoard
          initialProfiles={team as ProfileRow[]}
          canManage={role === "admin"}
          currentIsSuper={isSuper}
          currentUserId={user.id}
        />
      </>
    );
  }

  return (
    <>
      {hasAccess && tabs}
      {hasAccess ? (
        <>
          <div className="page-head">
            <div>
              <h1>Setări</h1>
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
                se face din <Link href="/setari?tab=echipa">Echipă</Link>.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({ROLE_LABEL[role]}) nu are acces la Setări.
        </div>
      )}
    </>
  );
}
