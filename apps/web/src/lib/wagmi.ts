import { createConfig, http, injected } from "wagmi";
import { hardhat } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [hardhat],
  connectors: [
    injected(),
  ],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});
