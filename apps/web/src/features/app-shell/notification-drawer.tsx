"use client";

import { Bell, X } from "lucide-react";
import type { Lang, UiText } from "@/features/prototype/types";

export function NotificationDrawer({
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close notifications" onClick={onClose} className="absolute inset-0 bg-black/20" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[380px] bg-card border-s border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-[60px] border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-foreground">{t.notifications}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-primary hover:underline font-medium">{t.markAllRead}</button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 px-5 py-4 border-b border-border/50 hover:bg-muted/30 transition-colors ${
                notification.unread ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notification.unread ? "bg-blue-500" : "bg-transparent"}`} />
              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed">{notification.text}</p>
                <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
