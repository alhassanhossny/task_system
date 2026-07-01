"use client";

import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, ChevronDown, Globe, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-store";
import type { Lang, UiText } from "@/features/prototype/types";
import { CommandPalette } from "@/features/search/command-palette";
import { pageTitleFromPath } from "./nav";
import { NotificationDropdown } from "./notification-dropdown";

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
  const [searchOpen, setSearchOpen] = useState(false);
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

        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 ps-3 pe-4 py-2 w-64 rounded-xl border border-border bg-input-background text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="truncate">{t.globalSearch}</span>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label={t.globalSearch}
        >
          <Search className="w-4.5 h-4.5" />
        </button>

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

        <div className="relative">
          <button
            onClick={() => setNotifOpen((open) => !open)}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-2 end-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-card" />
          </button>
          <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} t={t} lang={lang} />
        </div>

        <button
          onClick={logout}
          title={t.logout}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>

      <CommandPalette open={searchOpen} onOpen={() => setSearchOpen(true)} onClose={() => setSearchOpen(false)} t={t} lang={lang} />
    </header>
  );
}
