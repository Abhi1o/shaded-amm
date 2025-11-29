// Calculation utility functions for DEX operations

// Memoization cache for expensive calculations
const calculationCache = new Map<string, any>();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 5000; // 5 seconds - reduced from 30s for more accurate calculations with real-time pool data

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

function getCacheKey(...args: any[]): string {
  return JSON.stringify(args);
}

function getCached<T>(key: string): T | null {
  const entry = calculationCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    calculationCache.delete(key);
    return null;
  }
  
  return entry.value;
}

function setCache<T>(key: string, value: T): void {
  if (calculationCache.size >= CACHE_MAX_SIZE) {
    const firstKey = calculationCache.keys().next().value;
    calculationCache.delete(firstKey);
  }
  
  calculationCache.set(key, {
    value,
    timestamp: Date.now(),
  });
}

export const calculateSwapOutput = (
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  fee: number = 0.003 // 0.3% fee
): bigint => {
  const cacheKey = getCacheKey('swapOutput', inputAmount.toString(), inputReserve.toString(), outputReserve.toString(), fee);
  const cached = getCached<bigint>(cacheKey);
  if (cached !== null) return cached;
  
  const feeMultiplier = BigInt(Math.floor((1 - fee) * 10000));
  const inputAmountWithFee = inputAmount * feeMultiplier / BigInt(10000);
  
  const numerator = inputAmountWithFee * outputReserve;
  const denominator = inputReserve + inputAmountWithFee;
  
  const result = numerator / denominator;
  setCache(cacheKey, result);
  return result;
};

export const calculatePriceImpact = (
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint
): number => {
  const cacheKey = getCacheKey('priceImpact', inputAmount.toString(), inputReserve.toString(), outputReserve.toString());
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;
  
  const currentPrice = Number(outputReserve) / Number(inputReserve);
  const outputAmount = calculateSwapOutput(inputAmount, inputReserve, outputReserve);
  const executionPrice = Number(outputAmount) / Number(inputAmount);
  
  const result = Math.abs((executionPrice - currentPrice) / currentPrice) * 100;
  setCache(cacheKey, result);
  return result;
};

export const calculateLiquidityTokens = (
  amountA: bigint,
  amountB: bigint,
  reserveA: bigint,
  reserveB: bigint,
  totalSupply: bigint
): bigint => {
  const cacheKey = getCacheKey('liquidityTokens', amountA.toString(), amountB.toString(), reserveA.toString(), reserveB.toString(), totalSupply.toString());
  const cached = getCached<bigint>(cacheKey);
  if (cached !== null) return cached;
  
  let result: bigint;
  
  if (totalSupply === BigInt(0)) {
    // Initial liquidity
    result = sqrt(amountA * amountB);
  } else {
    const liquidityA = (amountA * totalSupply) / reserveA;
    const liquidityB = (amountB * totalSupply) / reserveB;
    result = liquidityA < liquidityB ? liquidityA : liquidityB;
  }
  
  setCache(cacheKey, result);
  return result;
};

// Simple integer square root implementation
function sqrt(value: bigint): bigint {
  if (value < BigInt(0)) {
    throw new Error('Square root of negative number');
  }
  if (value < BigInt(2)) {
    return value;
  }
  
  let x = value;
  let y = (x + BigInt(1)) / BigInt(2);
  
  while (y < x) {
    x = y;
    y = (x + value / x) / BigInt(2);
  }
  
  return x;
}

// Clear cache utility (useful for testing or memory management)
export function clearCalculationCache(): void {
  calculationCache.clear();
}