import ProjectsBoard, { type ProjectRow, type ProjectTaskRow, type ProjectFileRow } from "@/components/ProjectsBoard";
import type { Owner } from "@/components/PipelineBoard";
import { getAppContext } from "@/lib/app-context";
import { OWNER_LEAD_SELECT } from "@/lib/selects";

export default async function ProiectePage() {
  const { supabase, user, role, access, team } = await getAppContext();
  const owners = team;
  const hasAccess = access.proiecte.view;

  const [{ data: projects }, { data: tasks }, { data: files }, { data: leads }] = await Promise.all([
    hasAccess
      ? supabase
          .from("projects")
          .select(OWNER_LEAD_SELECT)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    hasAccess
      ? supabase
          .from("project_tasks")
          .select("*, assignee:profiles(id, full_name, initials)")
          .order("position", { ascending: true })
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("project_files").select("*") : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      {hasAccess ? (
        <ProjectsBoard
          initialProjects={(projects ?? []) as ProjectRow[]}
          initialTasks={(tasks ?? []) as ProjectTaskRow[]}
          initialFiles={(files ?? []) as ProjectFileRow[]}
          owners={(owners ?? []) as Owner[]}
          leads={(leads ?? []) as { id: string; name: string }[]}
          canEdit={access.proiecte.edit && (role === "admin" || role === "manager")}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Closer" : role}) nu are acces la Proiecte — vezi matricea de
          permisiuni din Setări.
        </div>
      )}
    </>
  );
}
