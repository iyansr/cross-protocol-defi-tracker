import { wagmiConnectors } from "./wagmiConnectors";
import { createClient, http } from "viem";
import { mainnet, arbitrum } from "viem/chains";
import { createConfig } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum],
  connectors: wagmiConnectors(),
  ssr: true,
  client({ chain }) {
    return createClient({
      chain,
      transport: http(),
    });
  },
});
