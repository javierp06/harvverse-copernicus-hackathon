"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Droplets,
  Leaf,
  Loader2,
  Satellite,
  ShieldAlert,
  Sprout,
  TrendingDown,
} from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Input } from "@harvverse-copernicus-hackathon/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@harvverse-copernicus-hackathon/ui/components/select";
import { cn } from "@harvverse-copernicus-hackathon/ui/lib/utils";

import { trpc } from "@/utils/trpc";

const SCENARIOS = [
  {
    key: "lot_approved",
    label: "Lote aprobado",
    description: "Score listo, EUDR verificado y YieldPredict disponible.",
    icon: CheckCircle2,
  },
  {
    key: "eudr_blocked",
    label: "EUDR bloqueado",
    description: "Bloqueo por señal post-2020 y revisión humana.",
    icon: ShieldAlert,
  },
  {
    key: "water_stress",
    label: "Estrés hídrico",
    description: "Alerta preventiva por sequía o falta de agua.",
    icon: Droplets,
  },
  {
    key: "fungal_risk",
    label: "Riesgo por lluvia",
    description: "Exceso de lluvia y riesgo preventivo de hongos.",
    icon: BellRing,
  },
  {
    key: "ndvi_drop_money",
    label: "NDVI -> dinero",
    description: "Caída de verdor explicada como impacto financiero.",
    icon: TrendingDown,
  },
  {
    key: "roya_risk",
    label: "Roya",
    description: "Riesgo por humedad, temperatura y fenología.",
    icon: Leaf,
  },
  {
    key: "flowering_positive",
    label: "Floración positiva",
    description: "Señal positiva de trayectoria productiva.",
    icon: Sprout,
  },
] as const;

type ScenarioKey = (typeof SCENARIOS)[number]["key"];

type ApiError = {
  ok?: false;
  error?: string;
  message?: string;
};

type SentinelAgentDispatch = {
  ok: true;
  scenario: {
    message: {
      title: string;
      body: string;
    };
    context: {
      lot: {
        code: string;
        farmName: string;
        region: string;
      };
      snapshot: {
        riskScore: number | null;
        eudrStatus: string | null;
      };
      publicUrl: string;
      signals: {
        yieldRange: string;
      };
    };
  };
  sentinelAgent: {
    gupshup?: {
      delivered?: boolean;
      destination?: string | null;
      messageId?: string | null;
      error?: string | null;
    };
    outbound?: {
      messagePreview?: string;
    };
  };
};

const DEFAULT_OVERRIDES = {
  previousNdvi: "0.65",
  currentNdvi: "0.45",
  temperatureC: "22",
  humidityPct: "88",
  variety: "Bourbon",
  phenologyStage: "llenado de fruto",
};

function optionalNumber(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function needsNdviOverrides(scenario: ScenarioKey) {
  return scenario === "ndvi_drop_money";
}

function needsRoyaOverrides(scenario: ScenarioKey) {
  return scenario === "roya_risk";
}

export default function SentinelDemoAdminPage() {
  const [lotCode, setLotCode] = useState("");
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioKey>("ndvi_drop_money");
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
  const [farmerPhone, setFarmerPhone] = useState("");
  const [dispatchResult, setDispatchResult] =
    useState<SentinelAgentDispatch | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const selected = useMemo(
    () => SCENARIOS.find((scenario) => scenario.key === selectedScenario) ?? SCENARIOS[0],
    [selectedScenario],
  );
  const {
    data: availableLots = [],
    isLoading: lotsLoading,
    isError: lotsError,
  } = useQuery(trpc.lots.list.queryOptions({ status: "available" }));
  const selectedLot = useMemo(
    () => availableLots.find((lot) => lot.code === lotCode) ?? null,
    [availableLots, lotCode],
  );

  useEffect(() => {
    if (!lotCode && availableLots.length > 0) {
      const firstCode = availableLots[0]?.code;
      if (firstCode) setLotCode(firstCode);
    }
  }, [availableLots, lotCode]);

  async function sendScenario() {
    setIsDispatching(true);
    setDispatchError(null);
    setDispatchResult(null);

    try {
      const response = await fetch("/api/dashboard/sentinel/scenarios/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lotCode: lotCode.trim(),
          scenario: selectedScenario,
          farmerPhone: farmerPhone.trim(),
          dryRun: false,
          llm: "auto",
          demoOverrides: {
            previousNdvi: optionalNumber(overrides.previousNdvi),
            currentNdvi: optionalNumber(overrides.currentNdvi),
            temperatureC: optionalNumber(overrides.temperatureC),
            humidityPct: optionalNumber(overrides.humidityPct),
            variety: overrides.variety.trim() || undefined,
            phenologyStage: overrides.phenologyStage.trim() || undefined,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | SentinelAgentDispatch
        | ApiError
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ApiError | null;
        const message =
          errorPayload?.error ??
          errorPayload?.message ??
          `Sentinel Agent request failed with HTTP ${response.status}.`;
        throw new Error(message);
      }

      setDispatchResult(payload);
    } catch (cause) {
      setDispatchError(
        cause instanceof Error
          ? cause.message
          : "No se pudo enviar la alerta.",
      );
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#001020] px-4 py-8 text-[#EEEEEE] md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Badge className="mb-3 border-primary/25 bg-primary/10 text-primary" variant="outline">
              Admin demo
            </Badge>
            <h1 className="font-trenda text-3xl font-bold text-white md:text-4xl">
              Alertas Copernicus por WhatsApp
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55 md:text-base">
              Selecciona el lote, el número y el tipo de alerta. El mensaje se envía en vivo por
              Gupshup usando el último snapshot Copernicus del lote.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Link href="/dashboard/farmer">
              <ArrowLeft className="mr-2 size-4" />
              Volver
            </Link>
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="flex flex-col gap-6">
            <GlassCard className="border-primary/20 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Satellite className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Disparo de alerta</h2>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Lote
                  </span>
                  <Select
                    value={lotCode}
                    onValueChange={(value) => setLotCode(value ?? "")}
                    disabled={lotsLoading || lotsError || availableLots.length === 0}
                  >
                    <SelectTrigger className="min-h-11 border-white/15 bg-black/20 text-white">
                      <SelectValue
                        placeholder={
                          lotsLoading
                            ? "Cargando lotes..."
                            : lotsError
                              ? "No se pudieron cargar lotes"
                              : "Selecciona un lote"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.code ?? String(lot.id)}>
                          {lot.code ?? `Lote ${lot.id}`} · {lot.farmName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {selectedLot ? (
                  <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-white/55">
                    <p className="font-bold text-white">{selectedLot.farmName}</p>
                    <p className="mt-1">
                      {selectedLot.region}, {selectedLot.country} · {selectedLot.status}
                    </p>
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Número WhatsApp
                  </span>
                  <Input
                    inputMode="tel"
                    value={farmerPhone}
                    placeholder="504XXXXXXXX"
                    onChange={(event) => setFarmerPhone(event.target.value)}
                    className="h-11 border-white/15 bg-black/20 text-sm text-white"
                  />
                </label>

                {(needsNdviOverrides(selectedScenario) || needsRoyaOverrides(selectedScenario)) ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Variables para simular
                    </p>
                    {needsNdviOverrides(selectedScenario) ? (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">NDVI anterior</span>
                          <Input
                            inputMode="decimal"
                            value={overrides.previousNdvi}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                previousNdvi: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">NDVI actual</span>
                          <Input
                            inputMode="decimal"
                            value={overrides.currentNdvi}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                currentNdvi: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                      </div>
                    ) : null}
                    {needsRoyaOverrides(selectedScenario) ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">Temperatura C</span>
                          <Input
                            inputMode="decimal"
                            value={overrides.temperatureC}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                temperatureC: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">Humedad %</span>
                          <Input
                            inputMode="decimal"
                            value={overrides.humidityPct}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                humidityPct: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">Variedad</span>
                          <Input
                            value={overrides.variety}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                variety: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/45">Fenología</span>
                          <Input
                            value={overrides.phenologyStage}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                phenologyStage: event.target.value,
                              }))
                            }
                            className="h-10 border-white/15 bg-black/20 text-sm text-white"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  className="h-12 w-full bg-emerald-400 font-black text-[#001020] hover:bg-emerald-300"
                  disabled={
                    isDispatching ||
                    lotsLoading ||
                    !lotCode.trim() ||
                    !farmerPhone.trim()
                  }
                  onClick={() => void sendScenario()}
                >
                  {isDispatching ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <BellRing className="mr-2 size-4" />
                  )}
                  Enviar WhatsApp
                </Button>
              </div>
            </GlassCard>
          </section>

          <section className="flex flex-col gap-6">
            <GlassCard className="border-primary/20 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-lg font-bold text-white">Escenario</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SCENARIOS.map((scenario) => {
                  const Icon = scenario.icon;
                  const active = selectedScenario === scenario.key;
                  return (
                    <button
                      key={scenario.key}
                      type="button"
                      className={cn(
                        "flex min-h-28 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10 text-white"
                          : "border-white/10 bg-black/15 text-white/65 hover:border-white/25 hover:bg-white/[0.04]",
                      )}
                      onClick={() => {
                        setSelectedScenario(scenario.key);
                        setDispatchResult(null);
                        setDispatchError(null);
                      }}
                    >
                      <Icon className={cn("size-5", active ? "text-primary" : "text-white/40")} />
                      <span>
                        <span className="block text-sm font-bold">{scenario.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-white/50">
                          {scenario.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {selected.label}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    Resultado
                  </h2>
                </div>
                {dispatchResult?.sentinelAgent.gupshup?.delivered ? (
                  <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200" variant="outline">
                    Enviado
                  </Badge>
                ) : null}
              </div>

              {dispatchError ? (
                <div className="border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
                  {dispatchError}
                </div>
              ) : null}

              {!dispatchResult && !dispatchError ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                  <BellRing className="mb-4 size-10 text-white/25" />
                  <p className="max-w-md text-sm text-white/55">
                    Selecciona un escenario y presiona Enviar WhatsApp para disparar la alerta en vivo.
                  </p>
                </div>
              ) : null}

              {dispatchResult ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">Lote</p>
                      <p className="mt-2 font-bold text-white">
                        {dispatchResult.scenario.context.lot.code}
                      </p>
                      <p className="text-xs text-white/50">
                        {dispatchResult.scenario.context.lot.farmName}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">Score</p>
                      <p className="mt-2 font-bold text-white">
                        {dispatchResult.scenario.context.snapshot.riskScore ?? "pendiente"}/100
                      </p>
                      <p className="text-xs text-white/50">
                        EUDR {dispatchResult.scenario.context.snapshot.eudrStatus ?? "pendiente"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">Yield</p>
                      <p className="mt-2 font-bold text-white">
                        {dispatchResult.scenario.context.signals.yieldRange}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Mensaje enviado
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-white">
                      {dispatchResult.scenario.message.title}
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/75">
                      {dispatchResult.sentinelAgent.outbound?.messagePreview ??
                        dispatchResult.scenario.message.body}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/70">
                        Destino
                      </p>
                      <p className="mt-1 break-all font-bold text-white">
                        {dispatchResult.sentinelAgent.gupshup?.destination ?? farmerPhone}
                      </p>
                    </div>
                    <a
                      href={dispatchResult.scenario.context.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 bg-black/15 p-4 text-sm transition-colors hover:border-primary/35 hover:bg-primary/5"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                        QR público
                      </p>
                      <p className="mt-1 break-all font-bold text-primary">
                        Abrir prueba del lote
                      </p>
                    </a>
                  </div>

                  {dispatchResult.sentinelAgent.gupshup?.messageId ? (
                    <p className="break-all rounded-xl border border-white/10 bg-black/15 p-3 font-mono text-xs text-white/50">
                      {dispatchResult.sentinelAgent.gupshup.messageId}
                    </p>
                  ) : null}
                  {dispatchResult.sentinelAgent.gupshup?.error ? (
                    <div className="border border-yellow-400/25 bg-yellow-400/10 p-3 text-sm text-yellow-100">
                      {dispatchResult.sentinelAgent.gupshup.error}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </GlassCard>
          </section>
        </div>
      </div>
    </main>
  );
}
