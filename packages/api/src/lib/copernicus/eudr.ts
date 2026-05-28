export type EudrGateStatus = "verified" | "non_compliant" | "unknown";
export type EudrGateRiskLevel =
  | "low_risk"
  | "review_required"
  | "high_risk"
  | "unknown";
export type EudrGateConfidence = "low" | "medium" | "high";

export interface EudrGateInput {
  post2020DeforestationDetected?: boolean | null;
  evidenceSource?: string | null;
  reasons?: string[] | null;
  limitations?: string[] | null;
  evidenceDateRange?: {
    from: string;
    to: string;
  } | null;
}

export interface EudrSentinel2Observation {
  month: string;
  ndvi: number | null;
  validPixelCoverage: number | null;
}

export interface EudrGateResult {
  status: EudrGateStatus;
  eligibleForMarketplace: boolean;
  baseline: "2020-12-31";
  riskLevel: EudrGateRiskLevel;
  post2020DeforestationDetected: boolean;
  requiresManualReview: boolean;
  confidence: EudrGateConfidence;
  reasons: string[];
  limitations: string[];
  evidenceDateRange: {
    from: string;
    to: string;
  };
}

const DEFAULT_EVIDENCE_RANGE = {
  from: "2021-01-01",
  to: new Date().toISOString().slice(0, 10),
};

export function buildEudrGate(input: EudrGateInput = {}): EudrGateResult {
  const evidenceDateRange = input.evidenceDateRange ?? DEFAULT_EVIDENCE_RANGE;

  if (input.post2020DeforestationDetected === true) {
    return {
      status: "non_compliant",
      eligibleForMarketplace: false,
      baseline: "2020-12-31",
      riskLevel: "high_risk",
      post2020DeforestationDetected: true,
      requiresManualReview: true,
      confidence: input.evidenceSource ? "medium" : "low",
      reasons: input.reasons ?? [
        "Post-2020 deforestation was detected or reported for the lot evidence area.",
        "EUDR gate blocks marketplace eligibility regardless of numeric risk score.",
      ],
      limitations: input.limitations ?? [
        "This gate should be confirmed with official JRC forest baseline and loss evidence before production enforcement.",
      ],
      evidenceDateRange,
    };
  }

  if (input.post2020DeforestationDetected === false && input.evidenceSource) {
    return {
      status: "verified",
      eligibleForMarketplace: true,
      baseline: "2020-12-31",
      riskLevel: "low_risk",
      post2020DeforestationDetected: false,
      requiresManualReview: false,
      confidence: "medium",
      reasons: input.reasons ?? [
        `No post-2020 deforestation signal was found in ${input.evidenceSource}.`,
      ],
      limitations: input.limitations ?? [
        "This hackathon gate is preliminary and should be upgraded to official JRC forest baseline intersection before production use.",
      ],
      evidenceDateRange,
    };
  }

  return {
    status: "unknown",
    eligibleForMarketplace: false,
    baseline: "2020-12-31",
    riskLevel: "review_required",
    post2020DeforestationDetected: false,
    requiresManualReview: true,
    confidence: "low",
    reasons: [
      "Official JRC forest baseline and post-2020 loss evidence are not integrated yet.",
      "The lot remains blocked until EUDR evidence is verified.",
    ],
    limitations: [
      "Unknown is a conservative state, not proof of compliance or non-compliance.",
      "Production EUDR screening must intersect the lot polygon with official forest baseline and post-2020 loss evidence.",
    ],
    evidenceDateRange,
  };
}

export function buildEudrGateFromSentinel2(
  observations: EudrSentinel2Observation[],
): EudrGateResult {
  const usable = observations
    .filter(
      (observation): observation is EudrSentinel2Observation & { ndvi: number } =>
        typeof observation.ndvi === "number" &&
        (observation.validPixelCoverage == null || observation.validPixelCoverage >= 0.2),
    )
    .sort((first, second) => first.month.localeCompare(second.month));
  const baseline = usable.filter(
    (observation) => observation.month >= "2020-01" && observation.month <= "2020-12",
  );
  const postCutoff = usable.filter(
    (observation) => observation.month >= "2021-01",
  );
  const recent = usable.slice(-12);
  const evidenceDateRange = {
    from: usable[0]?.month ? `${usable[0].month}-01` : DEFAULT_EVIDENCE_RANGE.from,
    to: usable.at(-1)?.month ? `${usable.at(-1)?.month}-28` : DEFAULT_EVIDENCE_RANGE.to,
  };

  if (baseline.length < 3 || recent.length < 3) {
    return {
      status: "unknown",
      eligibleForMarketplace: false,
      baseline: "2020-12-31",
      riskLevel: "review_required",
      post2020DeforestationDetected: false,
      requiresManualReview: true,
      confidence: "low",
      reasons: [
        "Sentinel-2 post-2020 vegetation continuity evidence is too sparse for the EUDR gate.",
        `Usable 2020 baseline months: ${baseline.length}. Usable post-cutoff months: ${postCutoff.length}. Usable recent months: ${recent.length}.`,
      ],
      limitations: [
        "Clouds, small parcel size, and missing observations can hide land-cover change.",
        "Official JRC forest baseline intersection is still required before production enforcement.",
      ],
      evidenceDateRange,
    };
  }

  const baselineNdvi = average(baseline.map((observation) => observation.ndvi));
  const recentNdvi = average(recent.map((observation) => observation.ndvi));
  const ndviDrop = Number((baselineNdvi - recentNdvi).toFixed(3));
  const evidenceSource = "Sentinel-2 L2A post-2020 NDVI continuity screen";

  if (baselineNdvi >= 0.5 && recentNdvi < 0.35 && ndviDrop >= 0.22) {
    return buildEudrGate({
      post2020DeforestationDetected: true,
      evidenceSource,
      evidenceDateRange,
      reasons: [
        `Sentinel-2 NDVI dropped from ${baselineNdvi.toFixed(3)} baseline to ${recentNdvi.toFixed(3)} recent average after the EUDR cutoff.`,
        "The change is large enough to trigger the hackathon EUDR hard block.",
      ],
      limitations: [
        "This is a Sentinel-2 vegetation-loss signal, not a legal EUDR determination by itself.",
        "Official JRC forest baseline and forest-loss intersection should confirm the block before production use.",
      ],
    });
  }

  if (baselineNdvi >= 0.45 && recentNdvi >= 0.45 && ndviDrop < 0.18) {
    return buildEudrGate({
      post2020DeforestationDetected: false,
      evidenceSource,
      evidenceDateRange,
      reasons: [
        `Sentinel-2 vegetation continuity remained stable from ${baselineNdvi.toFixed(3)} baseline to ${recentNdvi.toFixed(3)} recent NDVI.`,
        "No post-2020 vegetation-loss signal crossed the hackathon EUDR block threshold.",
      ],
      limitations: [
        "This is a preliminary Copernicus screen and should be upgraded with official JRC forest baseline intersection.",
        "Small coffee lots still require polygon accuracy and field/document review for final EUDR compliance.",
      ],
    });
  }

  return {
    status: "unknown",
    eligibleForMarketplace: false,
    baseline: "2020-12-31",
    riskLevel: "review_required",
    post2020DeforestationDetected: false,
    requiresManualReview: true,
    confidence: "medium",
    reasons: [
      `Sentinel-2 NDVI changed from ${baselineNdvi.toFixed(3)} baseline to ${recentNdvi.toFixed(3)} recent average.`,
      "The signal is inconclusive, so the EUDR gate remains blocked pending review.",
    ],
    limitations: [
      "The vegetation signal does not prove compliance or non-compliance.",
      "Official JRC forest baseline and post-2020 loss evidence are still needed for a final EUDR decision.",
    ],
    evidenceDateRange,
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
