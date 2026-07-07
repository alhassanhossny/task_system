import {
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  List,
  Mail,
  Settings,
  Shield,
  UserCheck,
  Users,
  type LucideIcon
} from "lucide-react";
import type { PageId, UiText } from "@/features/prototype/types";
import { canViewPlatform } from "@/features/platform/platform-access";

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

export function buildNav(t: UiText, permissions: string[] = []): NavGroup[] {
  const groups: NavGroup[] = [
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
        { id: "team", href: "/team", icon: UserCheck, label: t.team },
        { id: "employees", href: "/employees", icon: Users, label: t.employees },
        { id: "leaves", href: "/leaves", icon: Calendar, label: t.leaves }
      ]
    },
    {
      label: t.communication,
      items: [{ id: "email", href: "/email", icon: Mail, label: t.email }]
    },
    ...(canViewPlatform(permissions)
      ? [
          {
            label: t.platform,
            items: [
              { id: "platform-dashboard" as const, href: "/platform", icon: Shield, label: t.platformDashboard },
              { id: "platform-companies" as const, href: "/platform/companies", icon: Building2, label: t.companies },
              { id: "platform-subscriptions" as const, href: "/platform/subscriptions", icon: CreditCard, label: t.subscriptions },
              { id: "platform-plans" as const, href: "/platform/plans", icon: List, label: t.plans },
              { id: "platform-analytics" as const, href: "/platform/analytics", icon: BarChart3, label: t.analytics },
              { id: "platform-settings" as const, href: "/platform/settings", icon: Settings, label: t.settings },
              { id: "platform-switch-sessions" as const, href: "/platform/switch-sessions", icon: KeyRound, label: t.switchSessions }
            ]
          }
        ]
      : [])
  ];

  return groups;
}

export function pageTitleFromPath(pathname: string, t: UiText) {
  if (pathname.includes("/platform/switch-sessions")) return t.switchSessions;
  if (pathname.includes("/platform/settings")) return t.settings;
  if (pathname.includes("/platform/analytics")) return t.analytics;
  if (pathname.includes("/platform/plans")) return t.plans;
  if (pathname.includes("/platform/subscriptions")) return t.subscriptions;
  if (pathname.includes("/platform/companies")) return t.companies;
  if (pathname.includes("/platform")) return t.platformDashboard;
  if (pathname.includes("/tasks/kanban")) return t.kanban;
  if (pathname.includes("/tasks/list")) return t.taskList;
  if (pathname.includes("/team")) return t.team;
  if (pathname.includes("/leaves")) return t.leaves;
  if (pathname.includes("/email")) return t.email;
  if (pathname.includes("/employees")) return t.employees;
  if (pathname.includes("/super-admin")) return t.superAdmin;
  return t.dashboard;
}
