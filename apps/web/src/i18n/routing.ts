import { defineRouting } from "next-intl/routing";
import { defaultLocale, supportedLocales } from "@taskflow/config";

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale
});
