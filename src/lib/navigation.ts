import type { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide ikon nomi
  roles: Role[];
}

/** Rol asosidagi asosiy navigatsiya. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Boshqaruv paneli", icon: "LayoutDashboard", roles: ["ADMIN", "OPERATOR"] },
  { href: "/leads", label: "Mijozlar", icon: "KanbanSquare", roles: ["ADMIN", "OPERATOR", "TARGETOLOG"] },
  { href: "/tasks", label: "Vazifalar", icon: "ListChecks", roles: ["ADMIN", "OPERATOR"] },
  { href: "/reports", label: "Hisobotlar", icon: "BarChart3", roles: ["ADMIN", "TARGETOLOG"] },
  { href: "/targetolog", label: "Targetolog", icon: "Target", roles: ["ADMIN", "TARGETOLOG"] },
  { href: "/settings", label: "Sozlamalar", icon: "Settings", roles: ["ADMIN"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  OPERATOR: "Operator",
  TARGETOLOG: "Targetolog",
};
