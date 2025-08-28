import { Address, erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { multicall } from "@wagmi/core";
import { NONFUNGIBLE_POSITION_MANAGER_ABI, UNISWAP_V3_FACTORY_ABI } from "./abi";
import { useQuery } from "@tanstack/react-query";
import { wagmiConfig } from "../web3/wagmiConfig";
import { getSqrtRatioAtTick, isPositionInRange, calculateInRangeAmounts, calculateOutOfRangeAmounts } from "./utils";
import { useMemo } from "react";

interface PositionInfo {
  tokenId: bigint;
  nonce: bigint;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

interface EnhancedPositionInfo extends PositionInfo {
  // Calculated token amounts
  amount0: bigint;
  amount1: bigint;

  // USD values
  token0Price: number;
  token1Price: number;
  totalValueUSD: number;

  // Yield metrics
  feesEarned24h: number;
  currentAPY: number;

  // Pool info
  poolAddress: string;
  isInRange: boolean;

  // Additional properties from enriched data
  sqrtPriceX96: bigint;
  tickCurrent: number;
}

interface PositionDisplay {
  assetName: string;
  usdValue: number;
  yield24h: number;
  yield7d: number;
  apyPercentage: number;
  status: "active" | "inactive";
}

interface PortfolioMetrics {
  totalValueUSD: number;
  totalYield24h: number;
  averageAPY: number;
  totalFeesEarned: number;
  inRangePositions: number;
  outOfRangePositions: number;
}

// Constants
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as Address;
const UNISWAP_V3_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const COINGECKO_API_KEY = "CG-qJrsz9L4jz1hfbgxYR2iet7Q";

const positionManagerContract = {
  address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
} as const;

// Pool slot0 ABI for reuse
const POOL_SLOT0_ABI = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
    ],
  },
] as const;

// Combined function to fetch both decimals and symbols in one multicall
async function getTokenMetadata(addresses: string[]): Promise<{
  decimals: Record<string, number>;
  symbols: Record<string, string>;
}> {
  const decimalsCalls = addresses.map(addr => ({
    address: addr as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals" as const,
    args: [],
  }));

  const symbolsCalls = addresses.map(addr => ({
    address: addr as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol" as const,
    args: [],
  }));

  const [decimalsResults, symbolsResults] = await Promise.all([
    multicall(wagmiConfig, { contracts: decimalsCalls }),
    multicall(wagmiConfig, { contracts: symbolsCalls }),
  ]);

  const decimals = decimalsResults.reduce<Record<string, number>>((acc, res, i) => {
    if (res.status === "success") acc[addresses[i].toLowerCase()] = Number(res.result);
    return acc;
  }, {});

  const symbols = symbolsResults.reduce<Record<string, string>>((acc, res, i) => {
    if (res.status === "success") acc[addresses[i].toLowerCase()] = res.result as string;
    return acc;
  }, {});

  return { decimals, symbols };
}

export function useUniswapPositions(address: string) {
  const { data, isLoading } = useReadContract({
    ...positionManagerContract,
    functionName: "balanceOf",
    args: [address],
  });

  const queryKey = useMemo(() => ["uniswap-positions", Number(data), address], [data, address]);

  return useQuery({
    queryKey,
    enabled: !!address || !isLoading,
    staleTime: 30_000,
    gcTime: 30_000,
    queryFn: async () => {
      if (!data)
        return {
          totalPortfolioValueUSD: 0,
          yield24h: 0,
          averageAPY: 0,
          positions: [],
        };

      try {
        const numPositions = Number(data);

        const tokenIdCalls = Array.from({ length: numPositions }, (_, i) => ({
          ...positionManagerContract,
          functionName: "tokenOfOwnerByIndex",
          args: [address, BigInt(i)],
        }));

        const tokenIds = await multicall(wagmiConfig, {
          contracts: tokenIdCalls,
        });

        const validTokenIds = tokenIds
          .filter(result => result.status === "success")
          .map(result => result.result as bigint);

        // Prepare multicall for position details
        const positionCalls = validTokenIds.map(tokenId => ({
          ...positionManagerContract,
          functionName: "positions",
          args: [tokenId],
        }));

        // Execute multicall for positions
        const positionResults = await multicall(wagmiConfig, {
          contracts: positionCalls,
        });

        // Map results
        const basicPositions = positionResults
          .filter(result => result.status === "success")
          .map((result, index) => {
            const position = result.result as unknown as readonly [
              bigint,
              string,
              string,
              string,
              number,
              number,
              number,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
            ];

            return {
              tokenId: validTokenIds[index],
              nonce: position[0],
              operator: position[1],
              token0: position[2],
              token1: position[3],
              fee: Number(position[4]),
              tickLower: Number(position[5]),
              tickUpper: Number(position[6]),
              liquidity: position[7],
              feeGrowthInside0LastX128: position[8],
              feeGrowthInside1LastX128: position[9],
              tokensOwed0: position[10],
              tokensOwed1: position[11],
            };
          });

        const poolCalls = basicPositions.map(pos => ({
          address: UNISWAP_V3_FACTORY_ADDRESS,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "getPool",
          args: [pos.token0, pos.token1, pos.fee],
        }));

        const poolAddresses = await multicall(wagmiConfig, { contracts: poolCalls });

        const slot0Calls = poolAddresses.map(res => ({
          address: res.status === "success" ? (res.result as `0x${string}`) : "0x" + "0".repeat(40),
          abi: POOL_SLOT0_ABI,
          functionName: "slot0" as const,
          args: [],
        }));

        const slot0Results = await multicall(wagmiConfig, { contracts: slot0Calls });

        /* 3) token metadata and prices -------------------------------------- */
        const uniqueTokens = [
          ...new Set(basicPositions.flatMap(p => [p.token0.toLowerCase(), p.token1.toLowerCase()])),
        ];

        const [tokenMetadata, priceData] = await Promise.all([
          getTokenMetadata(uniqueTokens),
          fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${uniqueTokens.join(",")}&vs_currencies=usd&x_cg_demo_api_key=${COINGECKO_API_KEY}`,
          ).then(res => res.json()),
        ]);

        const { decimals: decimalsMap, symbols: symbolsMap } = tokenMetadata;

        /* 5) Calculate enhanced position data ---------------------------------- */
        const enriched = basicPositions
          .map((pos, idx) => {
            const slot = slot0Results[idx];
            if (slot.status !== "success") return null;

            const [sqrtPriceX96, tickCurrent] = slot.result as [bigint, number];

            const sqrtRatioL = getSqrtRatioAtTick(pos.tickLower);
            const sqrtRatioU = getSqrtRatioAtTick(pos.tickUpper);
            const inRange = isPositionInRange(tickCurrent, pos.tickLower, pos.tickUpper);

            const { amount0, amount1 } = inRange
              ? calculateInRangeAmounts(pos.liquidity, sqrtPriceX96, sqrtRatioL, sqrtRatioU)
              : calculateOutOfRangeAmounts(
                  pos.liquidity,
                  sqrtRatioL,
                  sqrtRatioU,
                  tickCurrent,
                  pos.tickLower,
                  pos.tickUpper,
                );

            const token0Price = priceData[pos.token0.toLowerCase()]?.usd || 0;
            const token1Price = priceData[pos.token1.toLowerCase()]?.usd || 0;

            // Get proper decimals for each token
            const token0Decimals = decimalsMap[pos.token0.toLowerCase()] || 18;
            const token1Decimals = decimalsMap[pos.token1.toLowerCase()] || 18;

            // Convert amounts to human readable using proper decimals
            const amount0Readable = Number(amount0) / Math.pow(10, token0Decimals);
            const amount1Readable = Number(amount1) / Math.pow(10, token1Decimals);

            // Convert fees owed to human readable using proper decimals
            const feesOwed0 = Number(pos.tokensOwed0) / Math.pow(10, token0Decimals);
            const feesOwed1 = Number(pos.tokensOwed1) / Math.pow(10, token1Decimals);

            // Calculate total value including both position amounts and unclaimed fees
            const positionValueUSD = amount0Readable * token0Price + amount1Readable * token1Price;
            const feesValueUSD = feesOwed0 * token0Price + feesOwed1 * token1Price;
            const totalValueUSD = positionValueUSD + feesValueUSD;

            // Calculate fees earned (simplified -  historical data for accurate 24h)
            const feesEarned24h = feesValueUSD; // For now, treat all unclaimed fees as 24h earnings

            // Simplified APY calculation (as percentage)
            const currentAPY = totalValueUSD > 0 ? ((feesEarned24h * 365) / totalValueUSD) * 100 : 0;

            return {
              ...pos,
              amount0,
              amount1,
              token0Price,
              token1Price,
              totalValueUSD,
              feesEarned24h,
              currentAPY,
              poolAddress: poolAddresses[idx].result as string,
              isInRange: inRange,
              sqrtPriceX96,
              tickCurrent,
            } as EnhancedPositionInfo;
          })
          .filter((pos): pos is EnhancedPositionInfo => pos !== null);

        const portfolioMetrics = calculatePortfolioMetrics(enriched);

        // Create individual position display data
        const positions: PositionDisplay[] = enriched.map(pos => {
          const token0Symbol = symbolsMap[pos.token0.toLowerCase()] || "Unknown";
          const token1Symbol = symbolsMap[pos.token1.toLowerCase()] || "Unknown";
          const assetName = `${token0Symbol}/${token1Symbol}`;

          return {
            assetName,
            usdValue: pos.totalValueUSD,
            yield24h: pos.feesEarned24h,
            yield7d: pos.feesEarned24h * 7, // Approximate 7d yield
            apyPercentage: pos.currentAPY, // Already a percentage
            status: pos.isInRange ? "active" : "inactive",
          };
        });

        // Return both portfolio metrics and individual positions
        return {
          totalPortfolioValueUSD: portfolioMetrics.totalValueUSD,
          yield24h: portfolioMetrics.totalYield24h,
          averageAPY: portfolioMetrics.averageAPY,
          positions,
        };
      } catch (error) {
        console.error("Error fetching Uniswap positions:", error);
        return {
          totalPortfolioValueUSD: 0,
          yield24h: 0,
          averageAPY: 0,
          positions: [],
        };
      }
    },
  });
}

function calculatePortfolioMetrics(positions: EnhancedPositionInfo[]): PortfolioMetrics {
  if (positions.length === 0) {
    return {
      totalValueUSD: 0,
      totalYield24h: 0,
      averageAPY: 0,
      totalFeesEarned: 0,
      inRangePositions: 0,
      outOfRangePositions: 0,
    };
  }

  const totalValueUSD = positions.reduce((sum, pos) => sum + pos.totalValueUSD, 0);
  const totalYield24h = positions.reduce((sum, pos) => sum + pos.feesEarned24h, 0);
  const averageAPY = positions.reduce((sum, pos) => sum + pos.currentAPY, 0) / positions.length;
  const inRangePositions = positions.filter(pos => pos.isInRange).length;

  return {
    totalValueUSD,
    totalYield24h,
    averageAPY,
    totalFeesEarned: totalYield24h, // Same as totalYield24h
    inRangePositions,
    outOfRangePositions: positions.length - inRangePositions,
  };
}
