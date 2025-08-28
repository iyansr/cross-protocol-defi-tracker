import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect } from "react";

type WalletAddress = {
  address: string;
  label?: string;
  isConnected?: boolean;
  addedAt: number;
};

type WalletStore = {
  wallets: WalletAddress[];
  activeWallet: string | null;

  // Actions
  addWallet: (address: string, label?: string) => void;
  removeWallet: (address: string) => void;
  updateWalletLabel: (address: string, label: string) => void;
  setActiveWallet: (address: string | null) => void;
  markWalletAsConnected: (address: string, isConnected: boolean) => void;
  clearAllWallets: () => void;

  // Getters
  getWalletByAddress: (address: string) => WalletAddress | undefined;
  getAllAddresses: () => string[];
  getConnectedWallets: () => WalletAddress[];
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      wallets: [],
      activeWallet: null,

      addWallet: (address: string, label?: string) => {
        const existingWallet = get().wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        if (existingWallet) return;

        const newWallet: WalletAddress = {
          address,
          label: label || `Wallet ${get().wallets.length + 1}`,
          isConnected: false,
          addedAt: Date.now(),
        };

        set(state => ({
          wallets: [...state.wallets, newWallet],
        }));
      },

      removeWallet: (address: string) => {
        set(state => ({
          wallets: state.wallets.filter(w => w.address.toLowerCase() !== address.toLowerCase()),
          activeWallet: state.activeWallet === address ? null : state.activeWallet,
        }));
      },

      updateWalletLabel: (address: string, label: string) => {
        set(state => ({
          wallets: state.wallets.map(w => (w.address.toLowerCase() === address.toLowerCase() ? { ...w, label } : w)),
        }));
      },

      setActiveWallet: (address: string | null) => {
        set({ activeWallet: address });
      },

      markWalletAsConnected: (address: string, isConnected: boolean) => {
        set(state => ({
          wallets: state.wallets.map(w =>
            w.address.toLowerCase() === address.toLowerCase() ? { ...w, isConnected } : w,
          ),
        }));
      },

      clearAllWallets: () => {
        set({ wallets: [], activeWallet: null });
      },

      getWalletByAddress: (address: string) => {
        return get().wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
      },

      getAllAddresses: () => {
        return get().wallets.map(w => w.address);
      },

      getConnectedWallets: () => {
        return get().wallets.filter(w => w.isConnected);
      },
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        wallets: state.wallets,
        activeWallet: state.activeWallet,
      }),
    },
  ),
);

// Hook to automatically sync connected wallet with store
export const useSyncConnectedWallet = (connectedAddress?: string) => {
  const { addWallet, markWalletAsConnected, setActiveWallet, wallets, activeWallet } = useWalletStore();

  useEffect(() => {
    if (!connectedAddress) {
      // No wallet connected, mark all as disconnected and clear active wallet
      wallets.forEach(wallet => {
        if (wallet.isConnected) {
          markWalletAsConnected(wallet.address, false);
        }
      });
      if (activeWallet) {
        setActiveWallet(null);
      }
      return;
    }

    // Check if connected wallet exists in store
    const existingWallet = wallets.find(w => w.address.toLowerCase() === connectedAddress.toLowerCase());

    // Add wallet if it doesn't exist
    if (!existingWallet) {
      addWallet(connectedAddress, "Connected Wallet");
    }

    // Only update if the connected wallet is not already marked as connected
    if (!existingWallet?.isConnected) {
      markWalletAsConnected(connectedAddress, true);
    }

    // Set as active wallet if not already active
    if (activeWallet !== connectedAddress) {
      setActiveWallet(connectedAddress);
    }

    // Mark other wallets as disconnected only if they are currently connected
    wallets.forEach(wallet => {
      if (wallet.address.toLowerCase() !== connectedAddress.toLowerCase() && wallet.isConnected) {
        markWalletAsConnected(wallet.address, false);
      }
    });
  }, [connectedAddress]);
};
