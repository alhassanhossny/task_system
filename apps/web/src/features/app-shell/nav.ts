import {
  Calendar,
  LayoutDashboard,
  LayoutGrid,
  List,
  Mail,
  Shield,
  Users,
  type LucideIcon
} from "lucide-react";
import type { PageId, UiText } from "@/features/prototype/types";

export interface NavItem {
  id: PageId;
  href: string;
  icon: LucideIcon;
  label: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export function buildNav(t: UiText): NavGroup[] {
  return [
    { label: null, items: [{ id: "dashboard", href: "/dashboard", icon: LayoutDashboard, label: t.dashboard }] },
    {
      label: t.tasks,
      items: [
        { id: "tasks-kanban", href: "/tasks/kanban", icon: LayoutGrid, label: t.kanban },
        { id: "tasks-list", href: "/tasks/list", icon: List, label: t.taskList }
      ]
    },
    {
      label: t.hr,
      items: [
        { id: "employees", href: "/employees", icon: Users, label: t.employees },
        { id: "leaves", href: "/leaves", icon: Calendar, label: t.leaves }
      ]
    },
    {
      label: t.communication,
      items: [{ id: "email", href: "/email", icon: Mail, label: t.email }]
    },
    {
      label: t.superAdmin,
      items: [{ id: "superadmin", href: "/super-admin", icon: Shield, label: t.companies }]
    }
  ];
}

export function pageTitleFromPath(pathname: string, t: UiText) {
  if (pathname.includes("/tasks/kanban")) return t.kanban;
  if (pathname.includes("/tasks/list")) return t.taskList;
  if (pathname.includes("/leaves")) return t.leaves;
  if (pathname.includes("/email")) return t.email;
  if (pathname.includes("/employees")) return t.employees;
  if (pathname.includes("/super-admin")) return t.superAdmin;
  return t.dashboard;
}
