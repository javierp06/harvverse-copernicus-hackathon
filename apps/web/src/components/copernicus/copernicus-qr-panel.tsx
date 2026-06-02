"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";

import { LanguageSwitcher } from "@/components/language-switcher";
import { CopernicusSectionHeader } from "./copernicus-ui";

const DEMO_WHATSAPP = "+19063794460";

export function CopernicusQrPanel({ lotCode }: { lotCode: string }) {
  const t = useTranslations("copernicus");
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPublicUrl(`${window.location.origin}/lot/${encodeURIComponent(lotCode)}`);
    }
  }, [lotCode]);

  async function copyUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappHref = `https://wa.me/${DEMO_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(
    t("whatsapp_share_text", { url: publicUrl, code: lotCode }),
  )}`;

  return (
    <GlassCard className="border-primary/25 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="size-5 text-primary" />
          <CopernicusSectionHeader title={t("qr_title")} description={t("qr_help")} />
        </div>
        <LanguageSwitcher compact />
      </div>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {publicUrl ? (
          <div className="rounded-xl bg-white p-3 shadow-lg">
            <QRCodeSVG value={publicUrl} size={140} level="M" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all font-mono text-xs text-primary">{publicUrl || "…"}</p>
          <Button
            type="button"
            size="sm"
            className="w-full bg-primary font-bold text-[#001020] hover:bg-primary/90"
            onClick={() => void copyUrl()}
          >
            {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
            {copied ? t("qr_copied") : t("qr_copy")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full border-white/15 text-white hover:bg-white/10"
            asChild
          >
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              {t("whatsapp_cta")}
            </a>
          </Button>
          <p className="text-[10px] text-white/35">{t("whatsapp_number_note")}</p>
        </div>
      </div>
    </GlassCard>
  );
}
