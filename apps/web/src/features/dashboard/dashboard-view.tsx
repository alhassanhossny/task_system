"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, CheckSquare, Mail, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/features/auth/auth-store";
import { leavesService } from "@/features/leaves/leaves-service";
import { ACTIVITIES, DEPT_CHART, STATUS_CHART } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function DashboardView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const [today, setToday] = useState("");
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const statsChartData = STATUS_CHART.map((d) => ({ name: lang === "ar" ? d.name : d.nameEn, value: d.value, fill: d.fill }));
  const deptChartData = DEPT_CHART.map((d) => ({ name: lang === "ar" ? d.nameAr : d.name, tasks: d.tasks, fill: d.fill }));

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const balanceYear = today ? Number(today.slice(0, 4)) : null;
  const availabilityRange = useMemo(
    () =>
      today
        ? {
            from: `${today}T00:00:00.000Z`,
            to: `${today}T23:59:59.999Z`
          }
        : null,
    [today]
  );
  const balancesQuery = useQuery({
    queryKey: ["dashboard", "leave-balances", balanceYear],
    queryFn: () => leavesService.balances(context!, { year: balanceYear ?? undefined }),
    enabled: Boolean(context && balanceYear)
  });
  const pendingLeavesQuery = useQuery({
    queryKey: ["dashboard", "pending-leaves"],
    queryFn: () => leavesService.list(context!, { status: "PENDING" }),
    enabled: Boolean(context)
  });
  const approvedLeavesQuery = useQuery({
    queryKey: ["dashboard", "approved-leaves"],
    queryFn: () => leavesService.list(context!, { status: "APPROVED" }),
    enabled: Boolean(context)
  });
  const availabilityQuery = useQuery({
    queryKey: ["dashboard", "team-availability", availabilityRange],
    queryFn: () => leavesService.availability(context!, availabilityRange!),
    enabled: Boolean(context && availabilityRange)
  });
  const balances = balancesQuery.data ?? [];
  const annualBalance = balances.find((balance) => balance.leaveType.code === "ANNUAL") ?? balances[0];
  const approvedLeaves = approvedLeavesQuery.data ?? [];
  const upcomingLeaves = approvedLeaves.filter((leave) => (today ? leave.startsAt.slice(0, 10) >= today : false)).length;
  const timeOffCards = [
    {
      label: lang === "ar" ? "رصيد الإجازة السنوية" : "Remaining Annual Leave",
      value: annualBalance ? formatDecimal(annualBalance.remainingDays) : "-",
      change: lang === "ar" ? "للموظف الحالي" : "current employee",
      I: Calendar,
      accent: "purple"
    },
    {
      label: lang === "ar" ? "طلبات بانتظار الموافقة" : "Pending Approvals",
      value: String(pendingLeavesQuery.data?.length ?? 0),
      change: lang === "ar" ? "طلبات نشطة" : "active requests",
      I: CheckSquare,
      accent: "amber"
    },
    {
      label: lang === "ar" ? "الفريق خارج العمل اليوم" : "Team Away Today",
      value: String(availabilityQuery.data?.onLeaveCount ?? 0),
      change: lang === "ar" ? `${availabilityQuery.data?.availableCount ?? 0} متاح` : `${availabilityQuery.data?.availableCount ?? 0} available`,
      I: Users,
      accent: "blue"
    },
    {
      label: lang === "ar" ? "إجازات قادمة" : "Upcoming Team Absences",
      value: String(upcomingLeaves),
      change: lang === "ar" ? "إجازات معتمدة" : "approved leave",
      I: TrendingUp,
      accent: "green"
    }
  ];
  const statCards = [
    { label: t.totalEmployees, value: lang === "ar" ? "٧" : "7", change: lang === "ar" ? "+٢ هذا الشهر" : "+2 this month", positive: true, I: Users, accent: "blue" },
    { label: t.openTasks, value: lang === "ar" ? "٩" : "9", change: lang === "ar" ? "+٣ اليوم" : "+3 today", positive: true, I: CheckSquare, accent: "amber" },
    { label: t.pendingLeaves, value: lang === "ar" ? "٢" : "2", change: lang === "ar" ? "طلبات جديدة" : "new requests", positive: false, I: Calendar, accent: "purple" },
    { label: t.sentEmails, value: lang === "ar" ? "٢٤" : "24", change: lang === "ar" ? "+٥ هذا الأسبوع" : "+5 this week", positive: true, I: Mail, accent: "green" }
  ];
  const accentMap: Record<string, { icon: string; bg: string }> = {
    blue: { icon: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
    amber: { icon: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    purple: { icon: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    green: { icon: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const ac = accentMap[s.accent];
          const Icon = s.I;
          return (
            <div key={s.label} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 ${ac.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${ac.icon}`} />
                </div>
                <TrendingUp className={`w-4 h-4 ${s.positive ? "text-green-500" : "text-red-400"}`} />
              </div>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">{s.label}</div>
              <div className={`text-xs mt-2 font-medium ${s.positive ? "text-green-500" : "text-red-400"}`}>{s.change}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {timeOffCards.map((s) => {
          const ac = accentMap[s.accent];
          const Icon = s.I;
          return (
            <div key={s.label} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 ${ac.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${ac.icon}`} />
                </div>
                <span className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "إجازات" : "Time off"}</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">{s.label}</div>
              <div className="text-xs mt-2 font-medium text-primary">{s.change}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t.tasksByStatus}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statsChartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={20} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statsChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t.tasksByDept}</h3>
          <div className="flex items-center gap-2">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={deptChartData} dataKey="tasks" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} strokeWidth={3} stroke="var(--card)">
                  {deptChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2.5">
              {deptChartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">{d.tasks}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t.recentActivity}</h3>
          <button className="text-xs text-primary hover:underline font-medium">{t.viewAll}</button>
        </div>
        <div className="space-y-1">
          {ACTIVITIES.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 group hover:bg-muted/30 rounded-xl px-2 -mx-2 transition-colors">
                <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${activity.color}`} />
                </div>
                <p className="flex-1 text-sm text-foreground min-w-0">
                  <span className="font-semibold">{lang === "ar" ? activity.user : activity.userEn}</span>{" "}
                  <span className="text-muted-foreground">{lang === "ar" ? activity.action : activity.actionEn}</span>{" "}
                  <span className="font-medium">{activity.target}</span>
                </p>
                <span className="text-xs text-muted-foreground flex-shrink-0">{activity.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDecimal(value: string | number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}
