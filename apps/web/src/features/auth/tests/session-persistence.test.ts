import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

const authStore = read("apps/web/src/features/auth/auth-store.tsx");
const appShell = read("apps/web/src/features/app-shell/app-shell.tsx");
const appTopbar = read("apps/web/src/features/app-shell/app-topbar.tsx");

assert.match(authStore, /const storageKey = "taskflow\.session"/, "auth storage key must remain locale-independent");
assert.match(authStore, /isHydrated: boolean/, "auth context must expose hydration state");
assert.match(authStore, /setIsHydrated\(true\)/, "auth provider must mark persisted session hydration complete");

assert.match(appShell, /auth\.isHydrated && !auth\.accessToken/, "protected shell must wait for auth hydration before redirecting");
assert.match(appShell, /if \(!auth\.isHydrated\)/, "protected shell must render a neutral state while auth storage hydrates");

const switchLocaleBody = appTopbar.slice(appTopbar.indexOf("function switchLocale()"), appTopbar.indexOf("function logout()"));
assert.ok(switchLocaleBody.includes("router.push"), "locale switch should navigate to the alternate locale");
assert.ok(!switchLocaleBody.includes("clearSession"), "locale switch must not clear the persisted session");

console.log("Session persistence assertions passed for locale switching and auth hydration.");
