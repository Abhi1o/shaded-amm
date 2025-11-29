/**
 * EVM Network Configurations
 *
 * Monad Testnet configuration only
 */

export interface EVMNetwork {
  chainId: number;
  name: string;
  displayName: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  logo?: string;
  color?: string;
}

// Monad Testnet - PRIMARY/DEFAULT CHAIN
export const MONAD_TESTNET: EVMNetwork = {
  chainId: 10143,
  name: "Monad Testnet",
  displayName: "Monad",
  rpcUrls: [
    process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    "https://rpc1.monad.xyz",
    "https://rpc3.monad.xyz",
  ],
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  blockExplorerUrls: [
    process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://monad-testnet.socialscan.io"
  ],
  color: "#6E54FF", // Purple theme color
};

export const SUPPORTED_NETWORKS: Record<number, EVMNetwork> = {
  [MONAD_TESTNET.chainId]: MONAD_TESTNET,
};

// Monad is the DEFAULT and ONLY chain
export const DEFAULT_NETWORK = MONAD_TESTNET;

// Array for easy iteration in UI - Monad only
export const NETWORK_LIST: EVMNetwork[] = [
  MONAD_TESTNET,
];

export function getNetworkByChainId(chainId: number): EVMNetwork | undefined {
  return SUPPORTED_NETWORKS[chainId];
}

export function isNetworkSupported(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}

export function getNetworkName(chainId: number): string {
  const network = getNetworkByChainId(chainId);
  return network ? network.displayName : `Unknown (${chainId})`;
}

export function getNetworkColor(chainId: number): string {
  const network = getNetworkByChainId(chainId);
  return network?.color || '#6E54FF';
}
