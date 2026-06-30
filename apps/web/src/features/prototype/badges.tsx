import type { Lang } from "./types";

const STATUS_CFG: Record<string, { bg: string; text: string; arLabel: string; enLabel: string }> = {
  new: { bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-700 dark:text-slate-200", arLabel: "جديد", enLabel: "New" },
  assigned: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", arLabel: "مُعيَّن", enLabel: "Assigned" },
  inProgress: { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300", arLabel: "قيد التنفيذ", enLabel: "In Progress" },
  pending: { bg: "bg-purple-100 dark:bg-purple-900/50", text: "text-purple-700 dark:text-purple-300", arLabel: "معلق", enLabel: "Pending" },
  completed: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", arLabel: "مكتمل", enLabel: "Completed" },
  cancelled: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", arLabel: "ملغى", enLabel: "Cancelled" },
  approved: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", arLabel: "موافق عليه", enLabel: "Approved" },
  rejected: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", arLabel: "مرفوض", enLabel: "Rejected" },
  active: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", arLabel: "نشط", enLabel: "Active" },
  inactive: { bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-500 dark:text-slate-400", arLabel: "غير نشط", enLabel: "Inactive" },
  trial: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", arLabel: "تجريبي", enLabel: "Trial" }
};

const PRIORITY_CFG: Record<string, { bg: string; text: string; dot: string; arLabel: string; enLabel: string }> = {
  low: { bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300", dot: "bg-slate-400", arLabel: "منخفض", enLabel: "Low" },
  medium: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", arLabel: "متوسط", enLabel: "Medium" },
  high: { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500", arLabel: "عالٍ", enLabel: "High" },
  critical: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", arLabel: "حرج", enLabel: "Critical" }
};

const STATUS_ALIASES: Record<string, string> = {
  NEW: "new",
  ASSIGNED: "assigned",
  IN_PROGRESS: "inProgress",
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

const PRIORITY_ALIASES: Record<string, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
};

export function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const c = STATUS_CFG[STATUS_ALIASES[status] ?? status] ?? STATUS_CFG.new;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {lang === "ar" ? c.arLabel : c.enLabel}
    </span>
  );
}

export function PriorityBadge({ priority, lang }: { priority: string; lang: Lang }) {
  const c = PRIORITY_CFG[PRIORITY_ALIASES[priority] ?? priority] ?? PRIORITY_CFG.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {lang === "ar" ? c.arLabel : c.enLabel}
    </span>
  );
}
