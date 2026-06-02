"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const locale = useLocale();

  function setLocale(next: "es" | "en") {
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  const base =
    "rounded font-bold uppercase tracking-wider transition-colors";
  const active = "bg-primary/20 text-primary";
  const inactive = "text-white/50 hover:bg-white/10 hover:text-white";

  return (
    <div
      className={`flex items-center gap-1 ${compact ? "text-[10px]" : "text-sm"}`}
      role="group"
      aria-label={locale === "es" ? "Idioma" : "Language"}
    >
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`${base} px-2 py-1 ${locale === "es" ? active : inactive}`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
      <span className="text-white/20">|</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`${base} px-2 py-1 ${locale === "en" ? active : inactive}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
