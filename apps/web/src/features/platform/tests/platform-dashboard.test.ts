import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../../../../../..");

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function assertContains(file: string, patterns: string[]) {
  const source = read(file);

  for (const pattern of patterns) {
    assert.ok(source.includes(pattern), `${file} should contain ${pattern}`);
  }
}

const routeFiles = [
  "apps/web/src/app/[locale]/(app)/platform/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/companies/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/subscriptions/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/plans/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/analytics/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/settings/page.tsx",
  "apps/web/src/app/[locale]/(app)/platform/switch-sessions/page.tsx"
];

for (const file of routeFiles) {
  assert.ok(existsSync(join(repoRoot, file)), `${file} should exist`);
  assertContains(file, ["PlatformView", "section="]);
}

assertContains("apps/web/src/features/platform/platform-access.ts", [
  "platform:read",
  "platform:manage",
  "companies:suspend",
  "subscriptions:manage",
  "tenant_switch:execute",
  "analytics:read",
  "platform_settings:update",
  "canViewPlatform"
]);

assertContains("apps/web/src/features/app-shell/nav.ts", [
  "canViewPlatform",
  "/platform",
  "/platform/companies",
  "/platform/subscriptions",
  "/platform/plans",
  "/platform/analytics",
  "/platform/settings",
  "/platform/switch-sessions"
]);

assertContains("apps/web/src/features/app-shell/app-sidebar.tsx", ["useAuth", "buildNav(t, user?.permissions ?? [])"]);

assertContains("apps/web/src/features/platform/platform-service.ts", [
  "/platform/analytics/overview",
  "/platform/analytics/usage",
  "/platform/analytics/top-companies",
  "/platform/analytics/subscription-distribution",
  "/platform/companies",
  "/platform/subscriptions",
  "/platform/plans",
  "/platform/settings",
  "/platform/switch-sessions",
  "/platform/switch-company"
]);

assertContains("apps/web/src/features/platform/platform-view.tsx", [
  "DashboardSection",
  "CompaniesSection",
  "SubscriptionsSection",
  "PlansSection",
  "AnalyticsSection",
  "SettingsSection",
  "SwitchSessionsSection",
  "PermissionDenied",
  "LoadingState",
  "ErrorState",
  "EmptyState",
  "suspendCompany",
  "activateCompany",
  "createSubscription",
  "createPlan",
  "createSwitchSession",
  "navigator.clipboard.writeText",
  "ResponsiveContainer",
  "ConfirmDialog",
  "SwitchTokenPanel"
]);

assertContains("apps/web/src/messages/en.json", ["\"platform\"", "\"platformDashboard\"", "\"switchSessions\""]);
assertContains("apps/web/src/messages/ar.json", ["\"platform\"", "\"platformDashboard\"", "\"switchSessions\""]);

console.log("platform-dashboard regression checks passed");
