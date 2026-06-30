"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-store";
import { useUiText } from "@/features/prototype/use-ui-text";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { t, lang } = useUiText();
  const fixedSurface = pathname.includes("/email") || pathname.includes("/tasks/kanban");

  useEffect(() => {
    if (!auth.accessToken) {
      router.replace(`/${lang}/login`);
    }
  }, [auth.accessToken, lang, router]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full">
        <AppSidebar t={t} lang={lang} collapsed={collapsed} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppTopbar t={t} lang={lang} sidebarCollapsed={collapsed} setSidebarCollapsed={setCollapsed} />
          <main className={`flex-1 min-h-0 ${fixedSurface ? "overflow-hidden" : "overflow-auto"}`}>{children}</main>
        </div>
      </div>
    </div>
  );
}
