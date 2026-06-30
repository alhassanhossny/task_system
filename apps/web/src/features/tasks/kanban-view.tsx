"use client";

import { Calendar, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { PriorityBadge } from "@/features/prototype/badges";
import { TASKS } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function KanbanView() {
  const { t, lang } = useUiText();
  const [selected, setSelected] = useState<number | null>(null);
  const columns = [
    { key: "new", label: lang === "ar" ? "جديد" : "New", dot: "bg-slate-400", hdr: "bg-slate-50 dark:bg-slate-800/60" },
    { key: "assigned", label: lang === "ar" ? "مُعيَّن" : "Assigned", dot: "bg-blue-500", hdr: "bg-blue-50 dark:bg-blue-900/20" },
    { key: "inProgress", label: lang === "ar" ? "قيد التنفيذ" : "In Progress", dot: "bg-amber-500", hdr: "bg-amber-50 dark:bg-amber-900/20" },
    { key: "pending", label: lang === "ar" ? "معلق" : "Pending", dot: "bg-purple-500", hdr: "bg-purple-50 dark:bg-purple-900/20" },
    { key: "completed", label: lang === "ar" ? "مكتمل" : "Completed", dot: "bg-green-500", hdr: "bg-green-50 dark:bg-green-900/20" },
    { key: "cancelled", label: lang === "ar" ? "ملغى" : "Cancelled", dot: "bg-red-400", hdr: "bg-red-50 dark:bg-red-900/20" }
  ];

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.kanban}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {TASKS.length} {t.totalTasks}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" />
          {t.addTask}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden" style={{ direction: "ltr" }}>
        <div className="flex gap-3 h-full pb-3" style={{ width: "max-content", minWidth: "100%" }}>
          {columns.map((column) => {
            const columnTasks = TASKS.filter((task) => task.status === column.key);
            return (
              <div key={column.key} className="w-72 flex flex-col gap-2 flex-shrink-0" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${column.hdr}`}>
                  <span className={`w-2 h-2 rounded-full ${column.dot}`} />
                  <span className="text-sm font-semibold text-foreground">{column.label}</span>
                  <span className="ms-auto w-5 h-5 bg-background rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelected(selected === task.id ? null : task.id)}
                      className={`bg-card rounded-xl border ${selected === task.id ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border hover:shadow-sm"} p-3.5 cursor-pointer transition-all group`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-sm font-medium text-foreground leading-snug flex-1">{lang === "ar" ? task.title : task.titleEn}</p>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <PriorityBadge priority={task.priority} lang={lang} />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {lang === "ar" ? task.dueDate : task.dueDateEn}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{task.dept}</span>
                        <div className={`w-6 h-6 ${task.avatarColor} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                          {lang === "ar" ? task.assignee[0] : task.assigneeEn[0]}
                        </div>
                      </div>
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                      <p className="text-sm text-muted-foreground/60">{t.noTasks}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
