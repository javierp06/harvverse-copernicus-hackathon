import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

function resolveLocale(value: string | undefined): Locale {
  return value === "en" ? "en" : "es";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
