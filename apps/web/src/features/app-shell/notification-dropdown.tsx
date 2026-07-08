"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useEffect } from "react";
import { notificationQueryKeys, notificationsService } from "@/features/notifications/notifications-service";
import type { Lang, UiText } from "@/features/prototype/types";

export function NotificationDropdown({
  open,
  onClose,
  t,
  lang,
  context
}: {
  open: boolean;
  onClose: () => void;
  t: UiText;
  lang: Lang;
  context: { token: string; companyId: string } | null;
}) {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: notificationQueryKeys.list(20),
    queryFn: () => notificationsService.list(context!, 20),
    enabled: open && Boolean(context)
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(context!, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    }
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(context!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    }
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

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
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={!context || unreadCount === 0 || markAllReadMutation.isPending}
              className="whitespace-nowrap text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
            >
              {t.markAllRead}
            </button>
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[min(24rem,calc(100vh-5rem))] overflow-y-auto">
          {notificationsQuery.isLoading && <DropdownState label={t.loading} />}
          {notificationsQuery.isError && <DropdownState label={t.error} />}
          {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && <DropdownState label={t.empty} />}
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => {
                if (!notification.isRead) {
                  markReadMutation.mutate(notification.id);
                }
              }}
              className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-muted/40 ${
                !notification.isRead ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
              }`}
            >
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${!notification.isRead ? "bg-blue-500" : "bg-transparent"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-relaxed text-foreground">{notification.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{notification.message}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{formatNotificationTime(notification.createdAt, lang)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DropdownState({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function formatNotificationTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
