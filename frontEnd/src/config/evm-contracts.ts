/**
 * EVM Contract Configurations
 * 
 * Defines factory and pool contract addresses for each network
 */

export interface ContractAddresses {
  factory: string;
  router?: string;
}

export const RISECHAIN_CONTRACTS: ContractAddresses = {
  factory: process.env.NEXT_PUBLIC_RISECHAIN_FACTORY || "0xa0Bb5eaDE9Ea3C8661881884d3a0b0565921aE48",
};

export const MONAD_CONTRACTS: ContractAddresses = {
  factory: process.env.NEXT_PUBLIC_MONAD_FACTORY || "0x70fe868ac814CC197631B60eEEaEaa1553418D03",
};

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  10143: MONAD_CONTRACTS, // Monad Testnet
  11155931: RISECHAIN_CONTRACTS, // RiseChain Testnet
};

export function getContractAddresses(chainId: number): ContractAddresses | undefined {
  return CONTRACT_ADDRESSES[chainId];
}
