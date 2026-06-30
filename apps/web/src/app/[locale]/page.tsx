import { redirect } from "next/navigation";
import { defaultLocale, supportedLocales } from "@taskflow/config";

export default async function LocaleIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = supportedLocales.includes(locale as (typeof supportedLocales)[number])
    ? locale
    : defaultLocale;

  redirect(`/${safeLocale}/login`);
}
