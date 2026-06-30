"use client";

import { Calendar, Clock, Plus } from "lucide-react";
import { useState } from "react";
import { Av } from "@/features/prototype/avatar";
import { StatusBadge } from "@/features/prototype/badges";
import { LEAVES } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

type LeaveRow = (typeof LEAVES)[number];

export function LeavesView() {
  const { t, lang } = useUiText();
  const [leaves, setLeaves] = useState<LeaveRow[]>(LEAVES);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.leaves}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leaves.length} {t.requests}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" />
          {t.requestLeave}
        </button>
      </div>

      <div className="space-y-3">
        {leaves.map((leave) => (
          <div key={leave.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
            <Av letter={leave.avatar} color={leave.color} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-semibold text-foreground text-sm">{lang === "ar" ? leave.employee : leave.employeeEn}</span>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{lang === "ar" ? leave.type : leave.typeEn}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {leave.start} — {leave.end}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {leave.days} {t.days}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={leave.status} lang={lang} />
              {leave.status === "pending" && (
                <>
                  <button
                    onClick={() => setLeaves((prev) => prev.map((item) => (item.id === leave.id ? { ...item, status: "approved" } : item)))}
                    className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                  >
                    {t.approve}
                  </button>
                  <button
                    onClick={() => setLeaves((prev) => prev.map((item) => (item.id === leave.id ? { ...item, status: "rejected" } : item)))}
                    className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    {t.reject}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
