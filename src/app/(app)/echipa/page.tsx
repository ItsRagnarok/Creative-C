import EchipaBoard, { type ProfileRow } from "@/components/EchipaBoard";
import { getAppContext } from "@/lib/app-context";

export default async function EchipaPage() {
  const { user, profile, role, access, team } = await getAppContext();
  const hasAccess = access.echipa.view;

  return (
    <>
      {hasAccess ? (
        <EchipaBoard
          initialProfiles={team as ProfileRow[]}
          canManage={role === "admin"}
          currentIsSuper={!!profile.is_super_admin}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Echipă — vezi matricea
          de permisiuni din Setări.
        </div>
      )}
    </>
  );
}
