"use client";

import { Bell, X } from "lucide-react";
import { useEffect } from "react";
import type { Lang, UiText } from "@/features/prototype/types";

export function NotificationDropdown({
  open,
  onClose,
  t,
  lang
}: {
  open: boolean;
  onClose: () => void;
  t: UiText;
  lang: Lang;
}) {
  const notifications = [
    { id: 1, text: lang === "ar" ? "مهمة جديدة: \"تطوير واجهة المستخدم\"" : "New task assigned: \"Develop UI Interface\"", time: lang === "ar" ? "منذ ١٠ د" : "10m ago", unread: true },
    { id: 2, text: lang === "ar" ? "وافقت سارة على طلب إجازتك" : "Sara approved your leave request", time: lang === "ar" ? "منذ ١ س" : "1h ago", unread: true },
    { id: 3, text: lang === "ar" ? "رسالة جديدة من محمد الحربي" : "New email from Mohammed Al-Harbi", time: lang === "ar" ? "منذ ٢ س" : "2h ago", unread: false }
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button type="button" aria-label="Close notifications" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-transparent" />
      <div
        role="dialog"
        aria-label={t.notifications}
        className="fixed inset-x-2 top-[58px] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-80"
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate text-sm font-bold text-foreground">{t.notifications}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="whitespace-nowrap text-xs font-medium text-primary hover:underline">
              {t.markAllRead}
            </button>
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[min(24rem,calc(100vh-5rem))] overflow-y-auto">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-muted/40 ${
                notification.unread ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
              }`}
            >
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${notification.unread ? "bg-blue-500" : "bg-transparent"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-relaxed text-foreground">{notification.text}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{notification.time}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
