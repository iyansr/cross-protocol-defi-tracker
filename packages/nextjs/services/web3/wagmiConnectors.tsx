import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import scaffoldConfig from "~~/scaffold.config";

const wallets = [
  braveWallet,
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],
    {
      appName: "scaffold-stylus",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
