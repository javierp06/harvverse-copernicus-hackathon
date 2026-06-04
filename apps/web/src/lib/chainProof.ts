export type SnapshotChainProof = {
  chainId: number;
  metadataStatus: "pending" | "written";
  transactionHash: string | null;
  carbonRegistry: {
    ok: boolean;
    contractAddress: string | null;
    transactionHash: string | null;
    carbonHash: string | null;
    state: string | null;
    methodVersion: string | null;
  } | null;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function getSnapshotChain(
  snapshot: { chain?: unknown } | null | undefined,
): SnapshotChainProof {
  const chain = asRecord(snapshot?.chain);
  const carbonRegistry = asRecord(chain?.carbonRegistry);

  return {
    chainId: typeof chain?.chainId === "number" ? chain.chainId : 31337,
    metadataStatus: chain?.metadataStatus === "written" ? "written" : "pending",
    transactionHash:
      typeof chain?.transactionHash === "string" ? chain.transactionHash : null,
    carbonRegistry: carbonRegistry
      ? {
          ok: Boolean(carbonRegistry.ok),
          contractAddress:
            typeof carbonRegistry.contractAddress === "string"
              ? carbonRegistry.contractAddress
              : null,
          transactionHash:
            typeof carbonRegistry.transactionHash === "string"
              ? carbonRegistry.transactionHash
              : null,
          carbonHash:
            typeof carbonRegistry.carbonHash === "string" ? carbonRegistry.carbonHash : null,
          state: typeof carbonRegistry.state === "string" ? carbonRegistry.state : null,
          methodVersion:
            typeof carbonRegistry.methodVersion === "string"
              ? carbonRegistry.methodVersion
              : null,
        }
      : null,
  };
}

export function chainLabel(chainId: number) {
  if (chainId === 31337) return "Hardhat local";
  if (chainId === 84532) return "Base Sepolia";
  return `Chain ${chainId}`;
}
