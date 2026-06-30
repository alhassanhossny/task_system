"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Building2, CheckSquare, Globe, Moon, Sun, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "./auth-store";
import { loginSchema, type LoginFormValues } from "./auth-schema";
import { authService } from "./auth-service";
import { useUiText } from "@/features/prototype/use-ui-text";

export function LoginView() {
  const { t, lang } = useUiText();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const [themeMounted, setThemeMounted] = useState(false);
  const isDark = themeMounted && resolvedTheme === "dark";
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@company.com",
      password: "Password123!"
    }
  });

  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess(data) {
      auth.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user
      });
      router.push(`/${lang}/dashboard`);
    }
  });

  function switchLocale() {
    router.push(`/${lang === "ar" ? "en" : "ar"}/login`);
  }

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-background" dir="ltr">
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden flex-col justify-center px-16"
        style={{ background: "linear-gradient(145deg, #1E3A8A 0%, #2563EB 45%, #3B82F6 80%, #1D4ED8 100%)" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="absolute top-1/2 right-12 w-48 h-48 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        <div className="relative z-10 text-white max-w-md">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">TASK Flow</span>
          </div>
          <h1 className="text-4xl font-bold mb-5 leading-tight whitespace-pre-line">
            {lang === "ar" ? "منصة إدارة\nالمهام المؤسسية" : "Enterprise Workflow\n& Communication"}
          </h1>
          <p className="text-blue-100 text-lg mb-14 leading-relaxed">
            {lang === "ar"
              ? "نظام متكامل لإدارة المهام والتواصل وتتبع الأداء في بيئة العمل الحديثة"
              : "A complete system for task management, communication, and performance tracking"}
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { n: lang === "ar" ? "+١٢٠٠" : "1,200+", l: lang === "ar" ? "مهمة مكتملة" : "Tasks Done", I: CheckSquare },
              { n: lang === "ar" ? "+٤٧٦" : "476+", l: lang === "ar" ? "موظف نشط" : "Active Users", I: Users },
              { n: lang === "ar" ? "+٤" : "4+", l: lang === "ar" ? "شركة" : "Companies", I: Building2 }
            ].map(({ n, l, I }) => (
              <div key={l} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <I className="w-5 h-5 text-blue-200 mb-2" />
                <div className="text-2xl font-bold">{n}</div>
                <div className="text-sm text-blue-200 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[480px] flex flex-col bg-card overflow-y-auto">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground">TASK Flow</span>
          </div>
          <div className="flex items-center gap-1.5 ms-auto">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
            >
              {themeMounted ? (
                isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )
              ) : (
                <span className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={switchLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium text-muted-foreground"
            >
              <Globe className="w-4 h-4" />
              {lang === "ar" ? "EN" : "عربي"}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10 lg:px-14 pb-14" dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="mb-10">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <CheckSquare className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">{t.loginTitle}</h2>
            <p className="text-muted-foreground mt-2">{t.loginSubtitle}</p>
          </div>
          <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t.emailLabel}</label>
              <input
                type="email"
                placeholder={t.emailPlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                {...form.register("email")}
              />
              {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t.passwordLabel}</label>
              <input
                type="password"
                placeholder={t.passwordPlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                {...form.register("password")}
              />
              {form.formState.errors.password && <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>}
            </div>
            <div className="flex justify-end">
              <button type="button" className="text-sm text-primary hover:underline font-medium">
                {t.forgotPass}
              </button>
            </div>
            {mutation.isError && <p className="text-sm text-red-500">{mutation.error.message}</p>}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-md shadow-primary/20 disabled:opacity-60"
            >
              {mutation.isPending ? t.loading : t.loginBtn}
            </button>
          </form>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            {lang === "ar" ? "© ٢٠٢٦ TASK Flow. جميع الحقوق محفوظة." : "© 2026 TASK Flow. All rights reserved."}
          </p>
        </div>
      </div>
    </div>
  );
}
