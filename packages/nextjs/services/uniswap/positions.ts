import { Address, erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { multicall } from "@wagmi/core";
import { NONFUNGIBLE_POSITION_MANAGER_ABI, UNISWAP_V3_FACTORY_ABI } from "./abi";
import { useQuery } from "@tanstack/react-query";
import { wagmiConfig } from "../web3/wagmiConfig";
import { getSqrtRatioAtTick, isPositionInRange, calculateInRangeAmounts, calculateOutOfRangeAmounts } from "./utils";

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

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as Address;

const positionManagerContract = {
  address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
} as const;
const UNISWAP_V3_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

const sampleAddress = "0x6539c065eFedcbc11a8160cEF9EcB8C7FFDc6364";

async function getDecimals(addresses: string[]): Promise<Record<string, number>> {
  const calls = addresses.map(addr => ({
    address: addr as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    args: [],
  }));
  const results = await multicall(wagmiConfig, { contracts: calls });
  return results.reduce<Record<string, number>>((acc, res, i) => {
    if (res.status === "success") acc[addresses[i].toLowerCase()] = Number(res.result);
    return acc;
  }, {});
}

async function getTokenSymbols(addresses: string[]): Promise<Record<string, string>> {
  const calls = addresses.map(addr => ({
    address: addr as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    args: [],
  }));
  const results = await multicall(wagmiConfig, { contracts: calls });
  return results.reduce<Record<string, string>>((acc, res, i) => {
    if (res.status === "success") acc[addresses[i].toLowerCase()] = res.result as string;
    return acc;
  }, {});
}

export function useUniswapPositions() {
  const { data, isLoading } = useReadContract({
    ...positionManagerContract,
    functionName: "balanceOf",
    args: [sampleAddress],
  });

  console.log({ data });

  return useQuery({
    queryKey: ["uniswap-positions", Number(data), sampleAddress],
    queryFn: async () => {
      if (!data) return [];

      const numPositions = Number(data);

      const tokenIdCalls = Array.from({ length: numPositions }, (_, i) => ({
        ...positionManagerContract,
        functionName: "tokenOfOwnerByIndex",
        args: [sampleAddress, BigInt(i)],
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

      console.log({ basicPositions });

      //  const

      const poolCalls = basicPositions.map(pos => ({
        address: UNISWAP_V3_FACTORY_ADDRESS,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "getPool",
        args: [pos.token0, pos.token1, pos.fee],
      }));

      const poolAddresses = await multicall(wagmiConfig, { contracts: poolCalls });

      const slot0Calls = poolAddresses.map(res => ({
        address: res.status === "success" ? (res.result as `0x${string}`) : "0x" + "0".repeat(40),
        abi: [
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
        ] as const,
        functionName: "slot0",
        args: [],
      }));

      const slot0Results = await multicall(wagmiConfig, { contracts: slot0Calls });

      /* 3) token decimals and symbols -------------------------------------- */
      const uniqueTokens = [...new Set(basicPositions.flatMap(p => [p.token0.toLowerCase(), p.token1.toLowerCase()]))];
      const decimalsMap = await getDecimals(uniqueTokens);
      const symbolsMap = await getTokenSymbols(uniqueTokens);

      /* 4) fetch token prices from CoinGecko -------------------------------- */
      const allTokens = [...new Set(basicPositions.flatMap(p => [p.token0.toLowerCase(), p.token1.toLowerCase()]))];
      const priceData = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${allTokens.join(",")}&vs_currencies=usd&x_cg_demo_api_key=CG-qJrsz9L4jz1hfbgxYR2iet7Q`,
      ).then(res => res.json());

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

          // Simplified APY calculation (historical volume/fee data)
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
          apyPercentage: pos.currentAPY * 100, // Convert to percentage
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
    },
    enabled: !isLoading,
  });
}

function calculatePortfolioMetrics(positions: EnhancedPositionInfo[]): PortfolioMetrics {
  const totalValueUSD = positions.reduce((sum, pos) => sum + pos.totalValueUSD, 0);
  const totalYield24h = positions.reduce((sum, pos) => sum + pos.feesEarned24h, 0);
  const totalFeesEarned = positions.reduce((sum, pos) => {
    // The fees are already calculated in the enhanced position data
    // We can extract them from the totalValueUSD calculation or use feesEarned24h
    return sum + pos.feesEarned24h;
  }, 0);

  const averageAPY =
    positions.length > 0 ? positions.reduce((sum, pos) => sum + pos.currentAPY, 0) / positions.length : 0;

  const inRangePositions = positions.filter(pos => pos.isInRange).length;
  const outOfRangePositions = positions.length - inRangePositions;

  return {
    totalValueUSD,
    totalYield24h,
    averageAPY,
    totalFeesEarned,
    inRangePositions,
    outOfRangePositions,
  };
}
