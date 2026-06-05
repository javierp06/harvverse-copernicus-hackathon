import { createConfig, http, injected } from "wagmi";
import { baseSepolia, hardhat } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [hardhat, baseSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
});
