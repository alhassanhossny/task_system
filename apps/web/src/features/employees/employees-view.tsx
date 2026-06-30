"use client";

import { Eye, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/features/prototype/badges";
import { EMPLOYEES } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function EmployeesView() {
  const { t, lang } = useUiText();
  const [search, setSearch] = useState("");
  const rows = EMPLOYEES.filter((employee) => {
    const q = search.toLowerCase();
    return !q || (lang === "ar" ? employee.name : employee.nameEn).toLowerCase().includes(q) || employee.email.includes(q);
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.employees}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} {t.employees_count}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" />
          {t.addEmployee}
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.search}
          className="w-full max-w-sm ps-10 pe-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[t.name, t.department, t.role, t.status, ""].map((h, i) => (
                  <th key={i} className="px-4 py-3.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 ${employee.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                        {employee.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{lang === "ar" ? employee.name : employee.nameEn}</p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-foreground">{lang === "ar" ? employee.dept : employee.deptEn}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-muted-foreground">
                      {lang === "ar" ? (employee.role === "manager" ? "مدير" : "موظف") : employee.role === "manager" ? "Manager" : "Employee"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={employee.status} lang={lang} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
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
