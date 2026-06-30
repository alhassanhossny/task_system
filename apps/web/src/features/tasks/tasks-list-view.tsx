"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { PriorityBadge, StatusBadge } from "@/features/prototype/badges";
import { TASKS } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function TasksListView() {
  const { t, lang } = useUiText();
  const [filter, setFilter] = useState("all");
  const filters = [
    { k: "all", l: lang === "ar" ? "الكل" : "All" },
    { k: "new", l: lang === "ar" ? "جديد" : "New" },
    { k: "inProgress", l: lang === "ar" ? "قيد التنفيذ" : "In Progress" },
    { k: "completed", l: lang === "ar" ? "مكتمل" : "Completed" }
  ];
  const rows = filter === "all" ? TASKS : TASKS.filter((task) => task.status === filter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.taskList}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} {t.tasks_count}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" />
          {t.addTask}
        </button>
      </div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.k ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[t.name, t.status, t.priority, t.assignee, t.dueDate, t.department].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-foreground">{lang === "ar" ? task.title : task.titleEn}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={task.status} lang={lang} />
                  </td>
                  <td className="px-4 py-3.5">
                    <PriorityBadge priority={task.priority} lang={lang} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 ${task.avatarColor} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                        {lang === "ar" ? task.assignee[0] : task.assigneeEn[0]}
                      </div>
                      <span className="text-sm text-foreground whitespace-nowrap">{lang === "ar" ? task.assignee : task.assigneeEn}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{lang === "ar" ? task.dueDate : task.dueDateEn}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-muted-foreground">{task.dept}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
