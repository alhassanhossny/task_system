"use client";

import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, ChevronDown, Globe, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-store";
import type { Lang, UiText } from "@/features/prototype/types";
import { pageTitleFromPath } from "./nav";
import { NotificationDrawer } from "./notification-drawer";

export function AppTopbar({
  t,
  lang,
  sidebarCollapsed,
  setSidebarCollapsed
}: {
  t: UiText;
  lang: Lang;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const auth = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const isDark = themeMounted && resolvedTheme === "dark";
  const title = pageTitleFromPath(pathname, t);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  function switchLocale() {
    const nextLocale = lang === "ar" ? "en" : "ar";
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    router.push(segments.join("/"));
  }

  function logout() {
    auth.clearSession();
    router.replace(`/${lang}/login`);
  }

  return (
    <header className="flex items-center justify-between h-[60px] px-4 border-b border-border bg-card flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-bold text-foreground hidden sm:block">{title}</h2>
      </div>

      <div className="flex items-center gap-1">
        <button className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-input-background hover:bg-muted transition-colors text-sm font-semibold text-foreground">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="max-w-[180px] truncate">{t.companySwitcher}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        <div className="relative hidden md:flex items-center">
          <Search className="absolute start-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            placeholder={t.globalSearch}
            className="ps-9 pe-4 py-2 w-64 rounded-xl border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:w-80 transition-all"
          />
        </div>

        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          {themeMounted ? (
            isDark ? (
              <Sun className="w-4.5 h-4.5" />
            ) : (
              <Moon className="w-4.5 h-4.5" />
            )
          ) : (
            <span className="w-4.5 h-4.5" aria-hidden="true" />
          )}
        </button>

        <button
          onClick={switchLocale}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-muted transition-colors text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === "ar" ? "EN" : "عربي"}
        </button>

        <button
          onClick={() => setNotifOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 end-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-card" />
        </button>

        <button
          onClick={logout}
          title={t.logout}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} t={t} lang={lang} />
    </header>
  );
}
