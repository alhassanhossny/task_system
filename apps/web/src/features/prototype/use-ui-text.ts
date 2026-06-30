"use client";

import { useLocale, useMessages } from "next-intl";
import type { Lang, UiText } from "./types";

export function useUiText() {
  const locale = useLocale() as Lang;
  const messages = useMessages() as { common: UiText };

  return {
    lang: locale,
    t: messages.common,
    isRTL: locale === "ar"
  };
}
