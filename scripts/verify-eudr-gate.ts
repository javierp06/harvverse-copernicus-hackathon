import {
  buildEudrGate,
  buildEudrGateFromSentinel2,
} from "../packages/api/src/lib/copernicus/eudr";

const pending = buildEudrGate();
const blocked = buildEudrGate({
  post2020DeforestationDetected: true,
  evidenceSource: "demo post-2020 forest-loss signal",
});
const sentinelVerified = buildEudrGateFromSentinel2([
  ...Array.from({ length: 12 }, (_, index) => ({
    month: `2020-${String(index + 1).padStart(2, "0")}`,
    ndvi: 0.62,
    validPixelCoverage: 0.72,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, "0")}`,
    ndvi: 0.58,
    validPixelCoverage: 0.7,
  })),
]);
const sentinelBlocked = buildEudrGateFromSentinel2([
  ...Array.from({ length: 12 }, (_, index) => ({
    month: `2020-${String(index + 1).padStart(2, "0")}`,
    ndvi: 0.64,
    validPixelCoverage: 0.75,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, "0")}`,
    ndvi: 0.28,
    validPixelCoverage: 0.72,
  })),
]);

console.log(
  JSON.stringify(
    {
      pending,
      blocked,
      sentinelVerified,
      sentinelBlocked,
      hardBlockWorks:
        blocked.status === "non_compliant" &&
        blocked.eligibleForMarketplace === false &&
        blocked.riskLevel === "high_risk" &&
        sentinelBlocked.status === "non_compliant" &&
        sentinelVerified.status === "verified",
    },
    null,
    2,
  ),
);

if (
  pending.eligibleForMarketplace ||
  !blocked.post2020DeforestationDetected ||
  sentinelBlocked.status !== "non_compliant" ||
  sentinelVerified.status !== "verified"
) {
  process.exitCode = 1;
}
