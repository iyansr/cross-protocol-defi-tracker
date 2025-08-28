import { arbitrum } from "wagmi/chains";
import { useQuery } from "@tanstack/react-query";
import { AaveClient, chainId, evmAddress } from "@aave/client";
import { userBorrows, userSupplies } from "@aave/client/actions";

const client = AaveClient.create();

interface AavePos {
  symbol: string;
  suppliedUsd: number;
  borrowedUsd: number;
  supplyAPY: number;
  borrowAPY: number;
}
interface AaveMetrics {
  totalCollateralUsd: number;
  totalDebtUsd: number;
  netValueUsd: number;
  avgSupplyAPY: number;
  avgBorrowAPY: number;
}

export const useAaveClientPositions = (address: string) => {
  return useQuery({
    queryKey: ["aave-client-positions", address],
    enabled: !!address,
    staleTime: 30_000,
    gcTime: 30_000,
    queryFn: async () => {
      if (!address) return { positions: [], metrics: {} };

      const markets = [
        {
          address: evmAddress(address),
          chainId: chainId(arbitrum.id),
        },
      ];

      const user = evmAddress(address);

      const result = await userSupplies(client, {
        markets,
        user,
      });

      const resultBorrow = await userBorrows(client, {
        markets,
        user,
      });

      if (result.isErr()) throw result.error;
      if (resultBorrow.isErr()) throw resultBorrow.error;

      const supplies = result.value;
      const borrows = resultBorrow.value;

      // Create a map to combine supply and borrow data by asset
      const positionMap = new Map<string, AavePos>();

      // Process supplies
      supplies.forEach((supply: any) => {
        const symbol = supply.reserve.symbol;
        const suppliedUsd =
          (parseFloat(supply.scaledATokenBalance) * parseFloat(supply.reserve.priceInUsd)) /
          Math.pow(10, supply.reserve.decimals);
        const supplyAPY = parseFloat(supply.reserve.liquidityRate) / 1e25; // Convert from ray to percentage

        positionMap.set(symbol, {
          symbol,
          suppliedUsd,
          borrowedUsd: 0,
          supplyAPY,
          borrowAPY: 0,
        });
      });

      // Process borrows
      borrows.forEach((borrow: any) => {
        const symbol = borrow.reserve.symbol;
        const borrowedUsd =
          (parseFloat(borrow.scaledVariableDebt) * parseFloat(borrow.reserve.priceInUsd)) /
          Math.pow(10, borrow.reserve.decimals);
        const borrowAPY = parseFloat(borrow.reserve.variableBorrowRate) / 1e25; // Convert from ray to percentage

        const existing = positionMap.get(symbol);
        if (existing) {
          existing.borrowedUsd = borrowedUsd;
          existing.borrowAPY = borrowAPY;
        } else {
          positionMap.set(symbol, {
            symbol,
            suppliedUsd: 0,
            borrowedUsd,
            supplyAPY: 0,
            borrowAPY,
          });
        }
      });

      const positions = Array.from(positionMap.values());

      // Calculate metrics
      const totalCollateralUsd = positions.reduce((sum, pos) => sum + pos.suppliedUsd, 0);
      const totalDebtUsd = positions.reduce((sum, pos) => sum + pos.borrowedUsd, 0);
      const netValueUsd = totalCollateralUsd - totalDebtUsd;

      // Calculate weighted average APYs
      const totalSuppliedValue = positions.reduce((sum, pos) => sum + pos.suppliedUsd, 0);
      const totalBorrowedValue = positions.reduce((sum, pos) => sum + pos.borrowedUsd, 0);

      const avgSupplyAPY =
        totalSuppliedValue > 0
          ? positions.reduce((sum, pos) => sum + pos.supplyAPY * pos.suppliedUsd, 0) / totalSuppliedValue
          : 0;

      const avgBorrowAPY =
        totalBorrowedValue > 0
          ? positions.reduce((sum, pos) => sum + pos.borrowAPY * pos.borrowedUsd, 0) / totalBorrowedValue
          : 0;

      const metrics: AaveMetrics = {
        totalCollateralUsd,
        totalDebtUsd,
        netValueUsd,
        avgSupplyAPY,
        avgBorrowAPY,
      };

      return {
        positions,
        metrics,
      };
    },
  });
};
