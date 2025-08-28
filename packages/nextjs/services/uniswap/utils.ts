import { Pool, TickMath, Position } from "@uniswap/v3-sdk";
import { Token as UniToken } from "@uniswap/sdk-core";
// Calculate sqrt ratios from ticks (this is what we actually need)
export function getSqrtRatioAtTick(tick: number): bigint {
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
}

// Check if position is in range
export function isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
  return currentTick >= tickLower && currentTick < tickUpper;
}

// Fixed calculation with proper bigint math
export function calculateInRangeAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  sqrtRatioL: bigint,
  sqrtRatioU: bigint,
): { amount0: bigint; amount1: bigint } {
  // Use proper bigint division with Q96 scaling
  const Q96 = BigInt(2) ** BigInt(96);

  // amount0 = liquidity * (sqrtRatioU - sqrtPriceX96) / (sqrtPriceX96 * sqrtRatioU / Q96)
  const numerator0 = liquidity * (sqrtRatioU - sqrtPriceX96);
  const denominator0 = (sqrtPriceX96 * sqrtRatioU) / Q96;
  const amount0 = numerator0 / denominator0;

  // amount1 = liquidity * (sqrtPriceX96 - sqrtRatioL) / Q96
  const amount1 = (liquidity * (sqrtPriceX96 - sqrtRatioL)) / Q96;

  return { amount0, amount1 };
}

// Fixed out-of-range calculation
export function calculateOutOfRangeAmounts(
  liquidity: bigint,
  sqrtRatioL: bigint,
  sqrtRatioU: bigint,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
): { amount0: bigint; amount1: bigint } {
  const Q96 = BigInt(2) ** BigInt(96);

  if (currentTick < tickLower) {
    // Position is below range - all token0
    const numerator = liquidity * (sqrtRatioU - sqrtRatioL);
    const denominator = (sqrtRatioL * sqrtRatioU) / Q96;
    const amount0 = numerator / denominator;
    return { amount0, amount1: 0n };
  } else if (currentTick >= tickUpper) {
    // Position is above range - all token1
    const amount1 = (liquidity * (sqrtRatioU - sqrtRatioL)) / Q96;
    return { amount0: 0n, amount1 };
  } else {
    // This shouldn't happen for out-of-range, but handle it
    return { amount0: 0n, amount1: 0n };
  }
}

/* ------------------------------------------------------------------ */
/* helper: SDK amount calculator                                      */
/* ------------------------------------------------------------------ */
export function calculateAmountsWithSDK(params: {
  token0Addr: string;
  token1Addr: string;
  decimals0: number;
  decimals1: number;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tickCurrent: number;
  tickLower: number;
  tickUpper: number;
  chainId: number;
}) {
  const {
    token0Addr,
    token1Addr,
    decimals0,
    decimals1,
    fee,
    liquidity,
    sqrtPriceX96,
    tickCurrent,
    tickLower,
    tickUpper,
    chainId,
  } = params;

  const token0 = new UniToken(chainId, token0Addr, decimals0);
  const token1 = new UniToken(chainId, token1Addr, decimals1);

  const pool = new Pool(token0, token1, fee, sqrtPriceX96.toString(), liquidity.toString(), tickCurrent);

  const position = new Position({
    pool,
    liquidity: liquidity.toString(),
    tickLower,
    tickUpper,
  });

  return {
    amount0: BigInt(position.amount0.quotient.toString()),
    amount1: BigInt(position.amount1.quotient.toString()),
  };
}
