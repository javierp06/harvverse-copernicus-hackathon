"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Copy,
  Droplets,
  Info,
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
import { Textarea } from "@harvverse-copernicus-hackathon/ui/components/textarea";
import { cn } from "@harvverse-copernicus-hackathon/ui/lib/utils";
import { trpc } from "@/utils/trpc";

const SCENARIOS = [
  {
    key: "lot_approved",
    label: "Lote aprobado",
    signal: "S6",
    description: "Score listo, EUDR verificado y YieldPredict disponible.",
    liveCondition: "riskScore >= 60, EUDR verified y eligibleForInvestment = true.",
    changedSignal: "El análisis Copernicus termina con score suficiente y sin bloqueo EUDR.",
    demoKnobs: "No requiere overrides; usa el snapshot actual del lote.",
    icon: CheckCircle2,
  },
  {
    key: "eudr_blocked",
    label: "EUDR bloqueado",
    signal: "S4",
    description: "Bloqueo duro por señal post-2020 y revisión humana.",
    liveCondition: "eudrStatus = non_compliant.",
    changedSignal: "La pantalla EUDR detecta pérdida/cambio de cobertura post-2020.",
    demoKnobs: "No hay override directo; se fuerza seleccionando este escenario.",
    icon: ShieldAlert,
  },
  {
    key: "water_stress",
    label: "Estrés hídrico",
    signal: "S3",
    description: "Sequía o falta de agua en etapa productiva.",
    liveCondition: "era5.waterStress = high.",
    changedSignal: "ERA5 o el modelo climático marca estrés hídrico alto.",
    demoKnobs: "Temperatura C puede contextualizar el mensaje; el escenario fuerza demo_seeded si el lote no está en high.",
    icon: Droplets,
  },
  {
    key: "fungal_risk",
    label: "Riesgo por lluvia",
    signal: "S5",
    description: "Exceso de lluvia y riesgo preventivo de hongos.",
    liveCondition: "era5.annualRainfallMm > 3000.",
    changedSignal: "La lluvia anualizada sube por encima del rango productivo del motor.",
    demoKnobs: "No hay override de lluvia todavía; se fuerza seleccionando este escenario.",
    icon: BellRing,
  },
  {
    key: "ndvi_drop_money",
    label: "NDVI -> dinero",
    signal: "S2",
    description: "Caída de verdor explicada como impacto financiero.",
    liveCondition: "currentNdvi < previousNdvi y la caída es significativa para el lote.",
    changedSignal: "Sentinel-2 muestra menor verdor/vigor contra la serie reciente.",
    demoKnobs: "NDVI anterior y NDVI actual simulan la caída; YieldPredict y dinero salen del snapshot.",
    icon: TrendingDown,
  },
  {
    key: "roya_risk",
    label: "Roya demo",
    signal: "S1",
    description: "Riesgo sembrado con humedad/temperatura manual.",
    liveCondition: "A futuro: temperatura 20-25 C, humedad >80% y/o leaf wetness sostenida.",
    changedSignal: "No viene completo de Copernicus hoy; requiere humedad/hoja mojada o sensor/local.",
    demoKnobs: "Temperatura, humedad, variedad y fenología simulan el caso de roya.",
    icon: Leaf,
  },
  {
    key: "explain_roya",
    label: "Explicar roya",
    signal: "S1",
    description: "Mensaje educativo sin recalcular Copernicus.",
    liveCondition: "El farmer o partner pregunta qué significa la alerta de roya.",
    changedSignal: "No depende de cambio satelital; es respuesta educativa grounded en KB.",
    demoKnobs: "No requiere overrides.",
    icon: Info,
  },
  {
    key: "flowering_positive",
    label: "Floración positiva",
    signal: "S6",
    description: "Señal positiva de trayectoria productiva.",
    liveCondition: "Snapshot live/fixture disponible y trayectoria vegetativa positiva.",
    changedSignal: "Sentinel-2 mantiene vigor sano o detecta recuperación/floración positiva.",
    demoKnobs: "No requiere overrides; usa el snapshot actual del lote.",
    icon: Sprout,
  },
] as const;

type ScenarioKey = (typeof SCENARIOS)[number]["key"];

type ScenarioResponse = {
  ok: true;
  scenario: ScenarioKey;
  signal: string;
  sourceMode: "fixture" | "live" | "demo_seeded" | "none";
  demoData: boolean;
  context: {
    lot: {
      code: string;
      farmName: string;
      region: string;
      country: string;
    };
    farmer: {
      name: string;
      phone: string | null;
    };
    snapshot: {
      riskScore: number | null;
      eudrStatus: string | null;
      eligibleForInvestment: boolean;
      scoreHash: string | null;
    };
    publicUrl: string;
    signals: {
      currentNdvi: number | null;
      previousNdvi: number | null;
      ndviDropPct: number | null;
      annualRainfallMm: number | null;
      meanTemperatureC: number | null;
      waterStress: string | null;
      yieldRange: string;
      partnerReturnTotalUsd: number | null;
      partnerProfitUsd: number | null;
      farmerProfitUsd: number | null;
      metadataStatus: string | null;
    };
  };
  knowledge: {
    title: string;
    threshold: string;
    meaning: string;
    impact: string;
    action: string;
    risk: string;
    guardrails: string[];
  };
  message: {
    templateKey: string;
    title: string;
    body: string;
    guardrails: string[];
  };
  whatsapp: {
    templateKey: string;
    variables: string[];
  };
};

type ApiError = {
  ok?: false;
  error?: string;
  message?: string;
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

function formatMoney(value: number | null) {
  if (value == null) return "pendiente";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function SentinelDemoAdminPage() {
  const [lotCode, setLotCode] = useState("");
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioKey>("ndvi_drop_money");
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<"message" | "json" | null>(null);

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

  const rawJson = result ? JSON.stringify(result, null, 2) : "";

  useEffect(() => {
    if (!lotCode && availableLots.length > 0) {
      const firstCode = availableLots[0]?.code;
      if (firstCode) setLotCode(firstCode);
    }
  }, [availableLots, lotCode]);

  async function triggerScenario() {
    setIsLoading(true);
    setError(null);
    setCopied(null);

    try {
      const response = await fetch("/api/dashboard/sentinel/scenarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lotCode: lotCode.trim(),
          scenario: selectedScenario,
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
        | ScenarioResponse
        | ApiError
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorPayload = payload as ApiError | null;
        const message =
          errorPayload?.error ??
          errorPayload?.message ??
          `Scenario request failed with HTTP ${response.status}.`;
        throw new Error(message);
      }

      setResult(payload);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "No se pudo generar la alerta.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyMessage() {
    if (!result?.message.body) return;
    const ok = await copyText(result.message.body);
    if (ok) {
      setCopied("message");
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  async function copyJson() {
    if (!rawJson) return;
    const ok = await copyText(rawJson);
    if (ok) {
      setCopied("json");
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  return (
    <main className="min-h-screen bg-[#001020] px-4 py-8 text-[#EEEEEE] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge className="border-primary/25 bg-primary/10 text-primary" variant="outline">
                Admin demo
              </Badge>
              <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200" variant="outline">
                Sentinel Agent
              </Badge>
            </div>
            <h1 className="font-trenda text-3xl font-bold text-white md:text-4xl">
              Trigger de alertas Copernicus
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60 md:text-base">
              Previsualiza el contexto, base de conocimiento, borrador en español y variables de
              WhatsApp para que Sheyla conecte AI SDK o el worker sin depender de n8n. Esta pantalla
              no envía WhatsApp todavía.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <Button
              className="bg-primary text-[#001020] hover:bg-primary/90"
              disabled={isLoading || lotsLoading || !lotCode.trim()}
              onClick={() => void triggerScenario()}
            >
              {isLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 size-4" />
              )}
              Generar payload
            </Button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="flex flex-col gap-6">
            <GlassCard className="border-primary/20 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Satellite className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Entrada de prueba</h2>
              </div>

              <div className="space-y-4">
                <div className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Lote disponible
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
                          {lot.code ?? `Lote ${lot.id}`} · {lot.farmName} · {lot.region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLot ? (
                    <div className="mt-3 grid gap-2 border border-white/10 bg-black/15 p-3 text-xs text-white/55">
                      <div className="flex items-center justify-between gap-3">
                        <span>Finca</span>
                        <span className="text-right font-semibold text-white/80">
                          {selectedLot.farmName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Ubicación</span>
                        <span className="text-right font-semibold text-white/80">
                          {selectedLot.region}, {selectedLot.country}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Status</span>
                        <span className="text-right font-semibold text-primary">
                          {selectedLot.status}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Escenario
                  </span>
                  <div className="grid gap-2">
                    {SCENARIOS.map((scenario) => {
                      const Icon = scenario.icon;
                      const active = selectedScenario === scenario.key;
                      return (
                        <button
                          key={scenario.key}
                          type="button"
                          className={cn(
                            "flex min-h-16 items-start gap-3 border p-3 text-left transition-colors",
                            active
                              ? "border-primary/60 bg-primary/10 text-white"
                              : "border-white/10 bg-black/15 text-white/65 hover:border-white/25 hover:bg-white/[0.04]",
                          )}
                          onClick={() => setSelectedScenario(scenario.key)}
                        >
                          <Icon
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              active ? "text-primary" : "text-white/40",
                            )}
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-bold">
                              {scenario.label}
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                                {scenario.signal}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-white/50">
                              {scenario.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Cuándo se dispara
                  </p>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed">
                    <p className="text-white/75">
                      <span className="font-semibold text-white">Condición real:</span>{" "}
                      {selected.liveCondition}
                    </p>
                    <p className="text-white/60">
                      <span className="font-semibold text-white/85">Qué cambia:</span>{" "}
                      {selected.changedSignal}
                    </p>
                    <p className="text-white/60">
                      <span className="font-semibold text-white/85">Override demo:</span>{" "}
                      {selected.demoKnobs}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-lg font-bold text-white">Overrides para demo</h2>
              <div className="grid gap-3 sm:grid-cols-2">
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
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                Estos valores solo fuerzan escenarios de demo. El contexto base siempre sale del
                snapshot Copernicus más reciente del lote.
              </p>
            </GlassCard>

            <GlassCard className="border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-2 text-lg font-bold text-white">Matriz de triggers</h2>
              <p className="mb-4 text-xs leading-relaxed text-white/45">
                Esta tabla separa las reglas reales de los campos que usamos para simular una alerta
                durante la demo local.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45">
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.14em]">
                        Alerta
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.14em]">
                        Condición real
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.14em]">
                        Qué tiene que cambiar
                      </th>
                      <th className="py-2 pl-3 font-semibold uppercase tracking-[0.14em]">
                        Demo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIOS.map((scenario) => (
                      <tr
                        key={scenario.key}
                        className={cn(
                          "border-b border-white/10 align-top",
                          selectedScenario === scenario.key ? "bg-primary/5" : "",
                        )}
                      >
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            className="text-left font-semibold text-primary hover:underline"
                            onClick={() => setSelectedScenario(scenario.key)}
                          >
                            {scenario.label}
                          </button>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                            {scenario.signal}
                          </div>
                        </td>
                        <td className="px-3 py-3 leading-relaxed text-white/65">
                          {scenario.liveCondition}
                        </td>
                        <td className="px-3 py-3 leading-relaxed text-white/55">
                          {scenario.changedSignal}
                        </td>
                        <td className="py-3 pl-3 leading-relaxed text-white/55">
                          {scenario.demoKnobs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </section>

          <section className="flex flex-col gap-6">
            <GlassCard className="border-primary/20 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {selected.label}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">Resultado del trigger</h2>
                </div>
                {result ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-white/15 bg-white/5 text-white" variant="outline">
                      {result.sourceMode}
                    </Badge>
                    <Badge
                      className={
                        result.demoData
                          ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"
                          : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      }
                      variant="outline"
                    >
                      {result.demoData ? "demo seeded" : "live context"}
                    </Badge>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {!result && !error ? (
                <div className="flex min-h-80 flex-col items-center justify-center border border-dashed border-white/10 bg-black/10 p-8 text-center">
                  <BellRing className="mb-4 size-10 text-white/25" />
                  <p className="max-w-md text-sm text-white/55">
                    Escoge un lote y un escenario para preparar el payload que verá WhatsApp/AI SDK.
                  </p>
                </div>
              ) : null}

              {result ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="border border-white/10 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/40">Lote</p>
                    <p className="mt-2 text-lg font-bold text-white">{result.context.lot.code}</p>
                    <p className="text-sm text-white/55">
                      {result.context.lot.farmName} · {result.context.lot.region}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/40">Score</p>
                    <p className="mt-2 text-lg font-bold text-white">
                      {result.context.snapshot.riskScore ?? "pendiente"}/100
                    </p>
                    <p className="text-sm text-white/55">
                      EUDR {result.context.snapshot.eudrStatus ?? "pendiente"}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/40">Yield</p>
                    <p className="mt-2 text-lg font-bold text-white">
                      {result.context.signals.yieldRange}
                    </p>
                    <p className="text-sm text-white/55">
                      Partner {formatMoney(result.context.signals.partnerReturnTotalUsd)}
                    </p>
                  </div>
                </div>
              ) : null}
            </GlassCard>

            {result ? (
              <>
                <GlassCard className="border-primary/20 bg-white/[0.03] p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Mensaje deterministic
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-white">{result.message.title}</h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => void copyMessage()}
                    >
                      <Copy className="mr-2 size-4" />
                      {copied === "message" ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={result.message.body}
                    className="min-h-32 resize-none border-white/15 bg-black/20 text-sm leading-relaxed text-white"
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="border border-white/10 bg-black/15 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                        Guardrails
                      </p>
                      <ul className="space-y-1 text-xs leading-relaxed text-white/55">
                        {result.message.guardrails.map((guardrail) => (
                          <li key={guardrail}>- {guardrail}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="border border-white/10 bg-black/15 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                        QR público
                      </p>
                      <a
                        href={result.context.publicUrl}
                        className="break-all text-sm font-semibold text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {result.context.publicUrl}
                      </a>
                    </div>
                  </div>
                </GlassCard>

                <div className="grid gap-6 xl:grid-cols-2">
                  <GlassCard className="border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Base de conocimiento
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-white">
                      {result.knowledge.title}
                    </h3>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/60">
                      <p>
                        <span className="font-semibold text-white/85">Umbral:</span>{" "}
                        {result.knowledge.threshold}
                      </p>
                      <p>
                        <span className="font-semibold text-white/85">Qué significa:</span>{" "}
                        {result.knowledge.meaning}
                      </p>
                      <p>
                        <span className="font-semibold text-white/85">Impacto:</span>{" "}
                        {result.knowledge.impact}
                      </p>
                      <p>
                        <span className="font-semibold text-white/85">Acción:</span>{" "}
                        {result.knowledge.action}
                      </p>
                    </div>
                  </GlassCard>

                  <GlassCard className="border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      WhatsApp template
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-white">
                      {result.whatsapp.templateKey}
                    </h3>
                    <div className="mt-4 space-y-2">
                      {result.whatsapp.variables.map((variable, index) => (
                        <div
                          key={`${variable}-${index}`}
                          className="grid grid-cols-[48px_1fr] gap-3 border border-white/10 bg-black/15 p-2 text-xs"
                        >
                          <span className="font-semibold text-primary">{`{{${index + 1}}}`}</span>
                          <span className="break-words text-white/65">{variable}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>

                <GlassCard className="border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-white">Payload JSON</h3>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => void copyJson()}
                    >
                      <Copy className="mr-2 size-4" />
                      {copied === "json" ? "Copiado" : "Copiar JSON"}
                    </Button>
                  </div>
                  <pre className="max-h-[520px] overflow-auto border border-white/10 bg-black/35 p-4 text-xs leading-relaxed text-white/65">
                    {rawJson}
                  </pre>
                </GlassCard>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
