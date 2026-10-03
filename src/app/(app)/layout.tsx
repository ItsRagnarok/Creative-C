import AppShell from "@/components/AppShell";
import { getAppContext } from "@/lib/app-context";

// The sidebar/topbar live here, so they stay mounted while you move between menus — only the page content
// swaps (with the skeleton from loading.tsx) instead of the whole screen being rebuilt on every click.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, role, access } = await getAppContext();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at, channel_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AppShell
      actualRole={role}
      access={access}
      isSuperAdmin={!!profile.is_super_admin}
      fullName={profile.full_name}
      initials={profile.initials}
      notifications={notifications ?? []}
    >
      {children}
    </AppShell>
  );
}
