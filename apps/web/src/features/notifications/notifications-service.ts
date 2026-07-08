import { apiFetch } from "@/lib/api/client";

export interface NotificationItem {
  id: string;
  companyId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiContext {
  token: string;
  companyId: string;
}

export const notificationQueryKeys = {
  all: ["notifications"] as const,
  list: (limit: number) => ["notifications", "list", limit] as const
};

export const notificationsService = {
  list(context: ApiContext, limit = 20) {
    return apiFetch<NotificationItem[]>(`/notifications?limit=${limit}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  markRead(context: ApiContext, id: string) {
    return apiFetch<NotificationItem>(`/notifications/${id}/read`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId
    });
  },
  markAllRead(context: ApiContext) {
    return apiFetch<{ updated: number }>("/notifications/read-all", {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId
    });
  }
};
