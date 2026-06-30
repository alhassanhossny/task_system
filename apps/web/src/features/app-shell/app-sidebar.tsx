"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, ChevronDown } from "lucide-react";
import { buildNav } from "./nav";
import type { Lang, UiText } from "@/features/prototype/types";

export function AppSidebar({ t, lang, collapsed }: { t: UiText; lang: Lang; collapsed: boolean }) {
  const pathname = usePathname();
  const nav = buildNav(t);

  return (
    <aside
      className={`${collapsed ? "w-[68px]" : "w-[248px]"} flex-shrink-0 bg-sidebar border-e border-sidebar-border flex flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-in-out`}
    >
      <div className="flex items-center gap-3 h-[60px] px-4 border-b border-sidebar-border flex-shrink-0">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
          <CheckSquare className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-[15px] text-foreground tracking-tight">TASK Flow</span>}
      </div>

      <nav className="flex-1 px-2 py-3">
        {nav.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && !collapsed && (
              <p className="px-3 py-1 mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const href = `/${lang}${item.href}`;
              const active = pathname === href;

              return (
                <Link
                  key={item.id}
                  href={href}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 border-s-[3px] ${
                    active
                      ? "bg-primary/10 text-primary border-primary"
                      : "border-transparent text-sidebar-foreground/70 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              أ
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{lang === "ar" ? "أحمد العلي" : "Ahmed Al-Ali"}</p>
              <p className="text-xs text-muted-foreground truncate">{lang === "ar" ? "مدير الشركة" : "Company Admin"}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      )}
    </aside>
  );
}
