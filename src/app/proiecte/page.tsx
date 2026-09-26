import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ProjectsBoard, { type ProjectRow, type ProjectTaskRow, type ProjectFileRow } from "@/components/ProjectsBoard";
import type { Owner } from "@/components/PipelineBoard";
import type { AppRole } from "@/lib/roles";

export default async function ProiectePage() {
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
  const hasAccess = role === "admin" || role === "manager" || role === "editor";

  const [{ data: projects }, { data: tasks }, { data: files }, { data: owners }, { data: leads }, { data: notifications }] = await Promise.all([
    hasAccess
      ? supabase
          .from("projects")
          .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    hasAccess
      ? supabase
          .from("project_tasks")
          .select("*, assignee:profiles(id, full_name, initials)")
          .order("position", { ascending: true })
      : Promise.resolve({ data: null }),
    hasAccess ? supabase.from("project_files").select("*") : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name, initials").order("full_name"),
    hasAccess ? supabase.from("leads").select("id, name").order("name") : Promise.resolve({ data: null }),
    supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <AppShell
      actualRole={role}
      fullName={profile.full_name}
      initials={profile.initials}
      activeKey="proiecte"
      title="Proiecte"
      subtitle="Livrare"
      notifications={notifications ?? []}
    >
      {hasAccess ? (
        <ProjectsBoard
          initialProjects={(projects ?? []) as ProjectRow[]}
          initialTasks={(tasks ?? []) as ProjectTaskRow[]}
          initialFiles={(files ?? []) as ProjectFileRow[]}
          owners={(owners ?? []) as Owner[]}
          leads={(leads ?? []) as { id: string; name: string }[]}
          canEdit={role === "admin" || role === "manager"}
          currentUserId={user.id}
        />
      ) : (
        <div className="empty-note" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          Contul tău ({role === "vanzari" ? "Vânzări" : role}) nu are acces la Proiecte — vezi matricea de
          permisiuni din Setări.
        </div>
      )}
    </AppShell>
  );
}
