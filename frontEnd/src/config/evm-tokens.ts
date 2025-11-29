/**
 * EVM Token Configurations
 * 
 * Defines token configurations for each supported network
 */

export interface EVMToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

// RiseChain Testnet Tokens
export const RISECHAIN_TOKENS: EVMToken[] = [
  {
    address: "0x1D4a4B63733B36400BFD388937F5bE6CBd5902cb",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 18,
    chainId: 11155931,
  },
  {
    address: "0x2250AD5DE3eCb3C84CC0deBbfaE145E5B99835Cd",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 18,
    chainId: 11155931,
  },
  {
    address: "0xAdE16eAbd36F0E9dea4224a1C27FA973dDe78d43",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    chainId: 11155931,
  },
];

// Monad Testnet Tokens
// IMPORTANT: These addresses MUST match dex-config-monad.json and backend API
export const MONAD_TOKENS: EVMToken[] = [
  {
    address: "0x9153bc242a5FD22b149B1cb252e3eE6314C37366",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    chainId: 10143,
  },
  {
    address: "0x39f0B52190CeA4B3569D5D501f0c637892F52379",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    chainId: 10143,
  },
  {
    address: "0xccA96CacCd9785f32C1ea02D688bc013D43D9f46",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    chainId: 10143,
  },
];

export const TOKENS_BY_CHAIN: Record<number, EVMToken[]> = {
  10143: MONAD_TOKENS, // Monad Testnet
  11155931: RISECHAIN_TOKENS, // RiseChain Testnet
};

export function getTokensByChainId(chainId: number): EVMToken[] {
  return TOKENS_BY_CHAIN[chainId] || [];
}

export function getTokenByAddress(chainId: number, address: string): EVMToken | undefined {
  const tokens = getTokensByChainId(chainId);
  return tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
}

export function getTokenBySymbol(chainId: number, symbol: string): EVMToken | undefined {
  const tokens = getTokensByChainId(chainId);
  return tokens.find(t => t.symbol === symbol);
}
