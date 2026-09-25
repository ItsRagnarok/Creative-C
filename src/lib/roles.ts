export type AppRole = "admin" | "manager" | "vanzari" | "editor";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  vanzari: "Vânzări",
  editor: "Editor",
};

export const ROLE_NOTE: Record<AppRole, string> = {
  admin: "Acces complet: date, financiar, roluri, integrări.",
  manager: "Acces operațional complet, fără gestionarea rolurilor.",
  vanzari: "Pipeline, clienți, programări, documente. Fără financiar.",
  editor: "Doar canalul propriu și task-urile alocate din proiecte.",
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
      { key: "clienti", label: "Clienți", href: "/clienti", icon: "◇", roles: ["admin", "manager", "vanzari"], enabled: true },
      { key: "programari", label: "Programări", href: "/programari", icon: "◔", roles: ["admin", "manager", "vanzari"], enabled: false },
    ],
  },
  {
    group: "Livrare",
    items: [
      { key: "proiecte", label: "Proiecte", href: "/proiecte", icon: "▤", roles: ["admin", "manager", "editor"], enabled: false },
      { key: "editori", label: "Canale editori", href: "/editori", icon: "◈", roles: ["admin", "manager", "editor"], enabled: false },
      { key: "echipa", label: "Echipă", href: "/echipa", icon: "◐", roles: ["admin", "manager"], enabled: false },
    ],
  },
  {
    group: "Business",
    items: [
      { key: "documente", label: "Documente & Contracte", href: "/documente", icon: "▥", roles: ["admin", "manager", "vanzari"], enabled: false },
      { key: "financiar", label: "Financiar", href: "/financiar", icon: "◑", roles: ["admin", "manager"], enabled: false },
      { key: "automatizari", label: "Automatizări", href: "/automatizari", icon: "⚡", roles: ["admin", "manager"], enabled: false },
    ],
  },
  {
    group: "Vitrine",
    items: [
      { key: "portal", label: "Portal client (preview)", href: "/portal-client", icon: "⧉", roles: ["admin", "manager"], ext: "CLIENT", enabled: false },
    ],
  },
  {
    group: "Sistem",
    items: [
      { key: "setari", label: "Setări & Roluri", href: "/setari", icon: "⚙", roles: ["admin"], enabled: false },
    ],
  },
];
