"use client";

import { Building2 } from "lucide-react";
import { StatusBadge } from "@/features/prototype/badges";
import { COMPANIES, SUPER_STATS } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function SuperAdminView() {
  const { t, lang } = useUiText();
  const planCls: Record<string, string> = {
    enterprise: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    professional: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    starter: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.superAdmin}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{lang === "ar" ? "إدارة شركات المنصة والاشتراكات" : "Manage platform companies and subscriptions"}</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {SUPER_STATS.map((stat) => {
          const Icon = stat.I;
          return (
            <div key={stat.v + stat.labelEn} className="bg-card rounded-2xl border border-border p-5">
              <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold text-foreground">{stat.v}</div>
              <div className="text-sm text-muted-foreground mt-1">{lang === "ar" ? stat.labelAr : stat.labelEn}</div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">{t.companies}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {COMPANIES.map((company) => (
            <div key={company.id} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{lang === "ar" ? company.name : company.nameEn}</p>
                    <p className="text-xs text-muted-foreground">{lang === "ar" ? company.admin : company.adminEn}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={company.status} lang={lang} />
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${planCls[company.plan]}`}>{t[company.plan] ?? company.plan}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{company.employees}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.employees_count}</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{company.activeUsers}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.activeUsers}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
