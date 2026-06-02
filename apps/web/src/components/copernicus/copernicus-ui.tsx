"use client";

import type { ComponentType, ReactNode } from "react";
import { HelpCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@harvverse-copernicus-hackathon/ui/components/tooltip";

export function CopernicusSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="group relative">
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{title}</h2>
        {description ? (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle
                className="size-3 text-primary/40 transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs leading-relaxed">{description}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

export function CopernicusMetric({
  icon: Icon,
  label,
  value,
  description,
  size = "md",
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-white/30">
          {Icon ? <Icon className="size-3.5 shrink-0 text-primary/60" /> : null}
          <p className="truncate text-[9px] font-bold uppercase tracking-wider">{label}</p>
        </div>
        {description ? (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="size-3 text-white/10 hover:text-primary/60" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-[11px] leading-relaxed">{description}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <p className={`mt-2 font-black text-white ${size === "sm" ? "text-base" : "text-xl"}`}>{value}</p>
    </div>
  );
}

export function CopernicusStatusPill({
  icon: Icon,
  label,
  value,
  description,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description?: string;
  variant?: "default" | "success" | "warning";
}) {
  const variantStyles = {
    default: "border-white/10 bg-white/[0.03] text-primary",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    warning: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
  };

  return (
    <div className={`rounded-xl border p-4 transition-all hover:bg-white/[0.05] ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      {description ? (
        <p className="mt-2 text-[11px] leading-relaxed text-white/40">{description}</p>
      ) : null}
    </div>
  );
}

export function CopernicusProofRow({
  label,
  value,
  description,
  mono = false,
}: {
  label: string;
  value: string;
  description?: string;
  mono?: boolean;
}) {
  return (
    <div className="group rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/40">
          {label}
          {description ? (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="size-2.5 text-white/10 group-hover:text-primary/40" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-[11px] leading-relaxed">{description}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
        <span className={`text-xs ${mono ? "font-mono text-primary" : "font-bold text-white"}`}>{value}</span>
      </div>
    </div>
  );
}

export function CopernicusCardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
