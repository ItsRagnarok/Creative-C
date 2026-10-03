export type AppRole = "admin" | "manager" | "vanzari" | "editor";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  vanzari: "Closer",
  editor: "Editor",
};

export const ROLE_NOTE: Record<AppRole, string> = {
  admin: "Acces complet: date, financiar, roluri, integrări.",
  manager: "Acces operațional complet, fără gestionarea rolurilor.",
  vanzari: "Pipeline, clienți, programări, documente. Fără financiar.",
  editor: "Canalele, calendarul de clipuri al clienților tăi și ghidurile pentru editori.",
};

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: AppRole[];
  ext?: string;
  enabled?: boolean;
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    group: "Vânzări",
    items: [
      { key: "dashboard", label: "Pipeline & Dashboard", href: "/dashboard", icon: "◆", roles: ["admin", "manager", "vanzari"], enabled: true },
      { key: "prospecti", label: "Prospecți", href: "/prospecti", icon: "◎", roles: ["admin", "manager", "vanzari"], enabled: true },
      { key: "clienti", label: "Clienți", href: "/clienti", icon: "◇", roles: ["admin", "manager", "vanzari"], enabled: true },
      { key: "programari", label: "Programări", href: "/programari", icon: "◔", roles: ["admin", "manager", "vanzari"], enabled: true },
    ],
  },
  {
    group: "Livrare",
    items: [
      { key: "editori", label: "Canale", href: "/editori", icon: "◈", roles: ["admin", "manager", "editor"], enabled: true },
    ],
  },
  {
    group: "Business",
    items: [
      { key: "documente", label: "Documente & Contracte", href: "/documente", icon: "▥", roles: ["admin", "manager", "vanzari"], enabled: true },
      { key: "financiar", label: "Financiar", href: "/financiar", icon: "◑", roles: ["admin", "manager"], enabled: true },
      { key: "automatizari", label: "Automatizări", href: "/automatizari", icon: "⚡", roles: ["admin", "manager"], enabled: true },
    ],
  },
  {
    group: "Vitrine",
    items: [
      { key: "portal", label: "Portal client (preview)", href: "/portal-client", icon: "⧉", roles: ["admin", "manager"], ext: "CLIENT", enabled: true },
    ],
  },
  {
    group: "Ghid editori",
    items: [
      { key: "standarde", label: "Standarde de editare", href: "/standarde", icon: "✦", roles: ["admin", "manager", "editor"], enabled: true },
      { key: "regulament", label: "Regulament", href: "/regulament", icon: "§", roles: ["admin", "manager", "editor"], enabled: true },
    ],
  },
  {
    group: "Sistem",
    items: [
      { key: "setari", label: "Setări", href: "/setari", icon: "⚙", roles: ["admin", "manager"], enabled: true },
      { key: "email", label: "Email", href: "/email", icon: "✉", roles: ["admin"], enabled: true },
    ],
  },
];
