/**
 * useLiquidity Hook
 * 
 * Manages liquidity operations for SAMM pools on Monad Testnet
 * Supports all 6 pools: USDC/USDT (3 shards) and USDT/DAI (3 shards)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { Address, formatUnits, parseUnits } from 'viem';
import { evmLiquidityService, calculateMinAmount } from '@/services/evmLiquidityService';
import { evmApprovalService } from '@/services/evmApprovalService';
import { sammBackendService } from '@/services/sammBackendService';
import toast from 'react-hot-toast';

// Monad Testnet tokens
const MONAD_TOKENS = {
  USDC: { address: '0x67DcA5710a9dA091e00093dF04765d711759f435' as Address, decimals: 6, symbol: 'USDC' },
  USDT: { address: '0x1888FF2446f2542cbb399eD179F4d6d966268C1F' as Address, decimals: 6, symbol: 'USDT' },
  DAI: { address: '0x60CB213FCd1616FbBD44319Eb11A35d5671E692e' as Address, decimals: 18, symbol: 'DAI' },
};

// All 6 pools on Monad Testnet
const MONAD_POOLS = [
  // USDC/USDT Shards
  { address: '0x686ff8090b18C0DF4f828f02deAf122CeC40B1DE' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 1, pairName: 'USDC/USDT' },
  { address: '0x0481CD694F9C4EfC925C694f49835547404c0460' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 2, pairName: 'USDC/USDT' },
  { address: '0x49ac6067BB0b6d5b793e9F3af3CD78b3a108AA5a' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 3, pairName: 'USDC/USDT' },
  // USDT/DAI Shards
  { address: '0x20c893A2706a71695894b15A4C385a3710C213eb' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 1, pairName: 'USDT/DAI' },
  { address: '0xe369Fe406ecB270b0F73C641260791C5A2edEB81' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 2, pairName: 'USDT/DAI' },
  { address: '0x4d3c19832713A7993d69870cB421586CBC36dceA' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 3, pairName: 'USDT/DAI' },
];

export interface PoolInfo {
  address: Address;
  tokenA: { address: Address; symbol: string; decimals: number };
  tokenB: { address: Address; symbol: string; decimals: number };
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  shardNumber: number;
  pairName: string;
}

export interface UseLiquidityReturn {
  // State
  loading: boolean;
  error: string | null;
  
  // Pool data
  pools: PoolInfo[];
  selectedPool: PoolInfo | null;
  
  // Add liquidity state
  tokenAAmount: string;
  tokenBAmount: string;
  expectedLPTokens: bigint;
  poolShare: number;
  
  // Remove liquidity state
  lpTokenAmount: string;
  expectedTokenA: bigint;
  expectedTokenB: bigint;
  userLPBalance: bigint;
  
  // User balances
  tokenABalance: bigint;
  tokenBBalance: bigint;
  
  // Actions
  selectPool: (poolAddress: Address) => void;
  setTokenAAmount: (amount: string) => void;
  setTokenBAmount: (amount: string) => void;
  setLPTokenAmount: (amount: string) => void;
  addLiquidity: (slippageTolerance: number) => Promise<string | null>;
  removeLiquidity: (slippageTolerance: number) => Promise<string | null>;
  refreshPools: () => Promise<void>;
  
  // Validation
  canAddLiquidity: boolean;
  canRemoveLiquidity: boolean;
  validationError: string | null;
}

export function useLiquidity(): UseLiquidityReturn {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null);
  
  // Add liquidity state
  const [tokenAAmount, setTokenAAmountState] = useState('');
  const [tokenBAmount, setTokenBAmountState] = useState('');
  const [expectedLPTokens, setExpectedLPTokens] = useState<bigint>(0n);
  const [poolShare, setPoolShare] = useState(0);
  
  // Remove liquidity state
  const [lpTokenAmount, setLPTokenAmountState] = useState('');
  const [expectedTokenA, setExpectedTokenA] = useState<bigint>(0n);
  const [expectedTokenB, setExpectedTokenB] = useState<bigint>(0n);
  const [userLPBalance, setUserLPBalance] = useState<bigint>(0n);
  
  // User balances
  const [tokenABalance, setTokenABalance] = useState<bigint>(0n);
  const [tokenBBalance, setTokenBBalance] = useState<bigint>(0n);

  // Check if on Monad Testnet
  const isMonadTestnet = chainId === 10143;


  // Fetch pool data from backend and blockchain
  const refreshPools = useCallback(async () => {
    if (!publicClient || !isMonadTestnet) {
      setPools([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get data from backend first
      let backendShards: any[] = [];
      try {
        const shardsResponse = await sammBackendService.getAllShards();
        backendShards = shardsResponse.shards || [];
      } catch (backendError) {
        console.warn('Backend unavailable, using blockchain data:', backendError);
      }

      // Fetch pool state for each pool
      const poolPromises = MONAD_POOLS.map(async (pool) => {
        try {
          // Try to get reserves from backend first
          const backendShard = backendShards.find(
            (s: any) => s.address.toLowerCase() === pool.address.toLowerCase()
          );

          let reserveA: bigint;
          let reserveB: bigint;
          let totalSupply: bigint;

          if (backendShard) {
            reserveA = BigInt(backendShard.reserves.reserveA);
            reserveB = BigInt(backendShard.reserves.reserveB);
            // Get total supply from blockchain
            totalSupply = await publicClient.readContract({
              address: pool.address,
              abi: [{ inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
              functionName: 'totalSupply',
            }) as bigint;
          } else {
            // Fallback to blockchain
            const state = await evmLiquidityService.getPoolState(publicClient, pool.address);
            reserveA = state.reserveA;
            reserveB = state.reserveB;
            totalSupply = state.totalSupply;
          }

          return {
            address: pool.address,
            tokenA: pool.tokenA,
            tokenB: pool.tokenB,
            reserveA,
            reserveB,
            totalSupply,
            shardNumber: pool.shardNumber,
            pairName: pool.pairName,
          };
        } catch (poolError) {
          console.error(`Failed to fetch pool ${pool.address}:`, poolError);
          return {
            address: pool.address,
            tokenA: pool.tokenA,
            tokenB: pool.tokenB,
            reserveA: 0n,
            reserveB: 0n,
            totalSupply: 0n,
            shardNumber: pool.shardNumber,
            pairName: pool.pairName,
          };
        }
      });

      const fetchedPools = await Promise.all(poolPromises);
      setPools(fetchedPools);
    } catch (err) {
      console.error('Failed to fetch pools:', err);
      setError('Failed to load pools. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [publicClient, isMonadTestnet]);

  // Fetch user balances when pool is selected
  const fetchUserBalances = useCallback(async () => {
    if (!publicClient || !userAddress || !selectedPool) {
      setTokenABalance(0n);
      setTokenBBalance(0n);
      setUserLPBalance(0n);
      return;
    }

    try {
      const [balanceA, balanceB, lpBalance] = await Promise.all([
        evmApprovalService.getTokenBalance(publicClient, selectedPool.tokenA.address, userAddress),
        evmApprovalService.getTokenBalance(publicClient, selectedPool.tokenB.address, userAddress),
        evmLiquidityService.getLPTokenBalance(publicClient, selectedPool.address, userAddress),
      ]);

      setTokenABalance(balanceA);
      setTokenBBalance(balanceB);
      setUserLPBalance(lpBalance);
    } catch (err) {
      console.error('Failed to fetch user balances:', err);
    }
  }, [publicClient, userAddress, selectedPool]);

  // Initial pool fetch
  useEffect(() => {
    refreshPools();
  }, [refreshPools]);

  // Fetch balances when pool changes
  useEffect(() => {
    fetchUserBalances();
  }, [fetchUserBalances]);

  // Select pool
  const selectPool = useCallback((poolAddress: Address) => {
    const pool = pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
    setSelectedPool(pool || null);
    // Reset amounts when pool changes
    setTokenAAmountState('');
    setTokenBAmountState('');
    setLPTokenAmountState('');
    setExpectedLPTokens(0n);
    setPoolShare(0);
    setExpectedTokenA(0n);
    setExpectedTokenB(0n);
  }, [pools]);

  // Calculate optimal amount B when amount A changes
  const setTokenAAmount = useCallback((amount: string) => {
    setTokenAAmountState(amount);
    
    if (!selectedPool || !amount || parseFloat(amount) <= 0) {
      setTokenBAmountState('');
      setExpectedLPTokens(0n);
      setPoolShare(0);
      return;
    }

    // Calculate optimal amount B based on reserves
    if (selectedPool.reserveA > 0n && selectedPool.reserveB > 0n) {
      const amountA = parseUnits(amount, selectedPool.tokenA.decimals);
      const optimalB = (amountA * selectedPool.reserveB) / selectedPool.reserveA;
      const optimalBFormatted = formatUnits(optimalB, selectedPool.tokenB.decimals);
      setTokenBAmountState(optimalBFormatted);

      // Calculate expected LP tokens
      const lpFromA = (amountA * selectedPool.totalSupply) / selectedPool.reserveA;
      const lpFromB = (optimalB * selectedPool.totalSupply) / selectedPool.reserveB;
      const lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
      setExpectedLPTokens(lpTokens);

      // Calculate pool share
      const newTotalSupply = selectedPool.totalSupply + lpTokens;
      const share = newTotalSupply > 0n 
        ? (Number(lpTokens) / Number(newTotalSupply)) * 100 
        : 0;
      setPoolShare(share);
    } else {
      // First liquidity provider - allow any ratio
      setExpectedLPTokens(0n);
      setPoolShare(100);
    }
  }, [selectedPool]);

  // Calculate optimal amount A when amount B changes
  const setTokenBAmount = useCallback((amount: string) => {
    setTokenBAmountState(amount);
    
    if (!selectedPool || !amount || parseFloat(amount) <= 0) {
      setTokenAAmountState('');
      setExpectedLPTokens(0n);
      setPoolShare(0);
      return;
    }

    // Calculate optimal amount A based on reserves
    if (selectedPool.reserveA > 0n && selectedPool.reserveB > 0n) {
      const amountB = parseUnits(amount, selectedPool.tokenB.decimals);
      const optimalA = (amountB * selectedPool.reserveA) / selectedPool.reserveB;
      const optimalAFormatted = formatUnits(optimalA, selectedPool.tokenA.decimals);
      setTokenAAmountState(optimalAFormatted);

      // Calculate expected LP tokens
      const lpFromA = (optimalA * selectedPool.totalSupply) / selectedPool.reserveA;
      const lpFromB = (amountB * selectedPool.totalSupply) / selectedPool.reserveB;
      const lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
      setExpectedLPTokens(lpTokens);

      // Calculate pool share
      const newTotalSupply = selectedPool.totalSupply + lpTokens;
      const share = newTotalSupply > 0n 
        ? (Number(lpTokens) / Number(newTotalSupply)) * 100 
        : 0;
      setPoolShare(share);
    }
  }, [selectedPool]);

  // Calculate expected tokens when LP amount changes
  const setLPTokenAmount = useCallback((amount: string) => {
    setLPTokenAmountState(amount);
    
    if (!selectedPool || !amount || parseFloat(amount) <= 0) {
      setExpectedTokenA(0n);
      setExpectedTokenB(0n);
      return;
    }

    const lpAmount = parseUnits(amount, 18); // LP tokens have 18 decimals
    
    if (selectedPool.totalSupply > 0n) {
      const tokenA = (lpAmount * selectedPool.reserveA) / selectedPool.totalSupply;
      const tokenB = (lpAmount * selectedPool.reserveB) / selectedPool.totalSupply;
      setExpectedTokenA(tokenA);
      setExpectedTokenB(tokenB);
    }
  }, [selectedPool]);


  // Add liquidity action
  const addLiquidity = useCallback(async (slippageTolerance: number): Promise<string | null> => {
    if (!publicClient || !walletClient || !userAddress || !selectedPool) {
      toast.error('Please connect your wallet');
      return null;
    }

    if (!isMonadTestnet) {
      toast.error('Please switch to Monad Testnet');
      return null;
    }

    if (!tokenAAmount || !tokenBAmount) {
      toast.error('Please enter amounts');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const amountA = parseUnits(tokenAAmount, selectedPool.tokenA.decimals);
      const amountB = parseUnits(tokenBAmount, selectedPool.tokenB.decimals);

      // Check balances
      if (amountA > tokenABalance) {
        throw new Error(`Insufficient ${selectedPool.tokenA.symbol} balance`);
      }
      if (amountB > tokenBBalance) {
        throw new Error(`Insufficient ${selectedPool.tokenB.symbol} balance`);
      }

      // Check and request approval for token A
      toast.loading(`Checking ${selectedPool.tokenA.symbol} approval...`, { id: 'approval-a' });
      const approvalA = await evmApprovalService.ensureApproval(
        walletClient,
        publicClient,
        selectedPool.tokenA.address,
        userAddress,
        selectedPool.address,
        amountA,
        'unlimited'
      );
      if (approvalA) {
        toast.success(`${selectedPool.tokenA.symbol} approved!`, { id: 'approval-a' });
      } else {
        toast.dismiss('approval-a');
      }

      // Check and request approval for token B
      toast.loading(`Checking ${selectedPool.tokenB.symbol} approval...`, { id: 'approval-b' });
      const approvalB = await evmApprovalService.ensureApproval(
        walletClient,
        publicClient,
        selectedPool.tokenB.address,
        userAddress,
        selectedPool.address,
        amountB,
        'unlimited'
      );
      if (approvalB) {
        toast.success(`${selectedPool.tokenB.symbol} approved!`, { id: 'approval-b' });
      } else {
        toast.dismiss('approval-b');
      }

      // Execute add liquidity
      toast.loading('Adding liquidity...', { id: 'add-liquidity' });
      const hash = await evmLiquidityService.addLiquidity(
        walletClient,
        publicClient,
        selectedPool.address,
        amountA,
        amountB,
        slippageTolerance,
        userAddress
      );

      toast.success('Liquidity added successfully!', { id: 'add-liquidity' });

      // Refresh data
      await Promise.all([refreshPools(), fetchUserBalances()]);

      // Reset form
      setTokenAAmountState('');
      setTokenBAmountState('');
      setExpectedLPTokens(0n);
      setPoolShare(0);

      return hash;
    } catch (err: any) {
      console.error('Add liquidity failed:', err);
      const errorMsg = err.message || 'Failed to add liquidity';
      
      // User-friendly error messages
      if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        toast.error('Transaction cancelled', { id: 'add-liquidity' });
      } else if (errorMsg.includes('insufficient')) {
        toast.error(errorMsg, { id: 'add-liquidity' });
      } else {
        toast.error('Failed to add liquidity. Please try again.', { id: 'add-liquidity' });
      }
      
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletClient, userAddress, selectedPool, isMonadTestnet, tokenAAmount, tokenBAmount, tokenABalance, tokenBBalance, refreshPools, fetchUserBalances]);

  // Remove liquidity action
  const removeLiquidity = useCallback(async (slippageTolerance: number): Promise<string | null> => {
    if (!publicClient || !walletClient || !userAddress || !selectedPool) {
      toast.error('Please connect your wallet');
      return null;
    }

    if (!isMonadTestnet) {
      toast.error('Please switch to Monad Testnet');
      return null;
    }

    if (!lpTokenAmount) {
      toast.error('Please enter LP token amount');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const lpAmount = parseUnits(lpTokenAmount, 18);

      // Check LP balance
      if (lpAmount > userLPBalance) {
        throw new Error('Insufficient LP token balance');
      }

      // Execute remove liquidity
      toast.loading('Removing liquidity...', { id: 'remove-liquidity' });
      const hash = await evmLiquidityService.removeLiquidity(
        walletClient,
        publicClient,
        selectedPool.address,
        lpAmount,
        slippageTolerance,
        userAddress
      );

      toast.success('Liquidity removed successfully!', { id: 'remove-liquidity' });

      // Refresh data
      await Promise.all([refreshPools(), fetchUserBalances()]);

      // Reset form
      setLPTokenAmountState('');
      setExpectedTokenA(0n);
      setExpectedTokenB(0n);

      return hash;
    } catch (err: any) {
      console.error('Remove liquidity failed:', err);
      const errorMsg = err.message || 'Failed to remove liquidity';
      
      // User-friendly error messages
      if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        toast.error('Transaction cancelled', { id: 'remove-liquidity' });
      } else if (errorMsg.includes('insufficient')) {
        toast.error(errorMsg, { id: 'remove-liquidity' });
      } else if (errorMsg.includes('slippage') || errorMsg.includes('amount')) {
        toast.error('Price changed too much. Try increasing slippage.', { id: 'remove-liquidity' });
      } else {
        toast.error('Failed to remove liquidity. Please try again.', { id: 'remove-liquidity' });
      }
      
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletClient, userAddress, selectedPool, isMonadTestnet, lpTokenAmount, userLPBalance, refreshPools, fetchUserBalances]);

  // Validation
  const canAddLiquidity = useMemo(() => {
    if (!isConnected || !selectedPool || !tokenAAmount || !tokenBAmount) return false;
    if (!isMonadTestnet) return false;
    
    try {
      const amountA = parseUnits(tokenAAmount, selectedPool.tokenA.decimals);
      const amountB = parseUnits(tokenBAmount, selectedPool.tokenB.decimals);
      return amountA > 0n && amountB > 0n && amountA <= tokenABalance && amountB <= tokenBBalance;
    } catch {
      return false;
    }
  }, [isConnected, selectedPool, tokenAAmount, tokenBAmount, tokenABalance, tokenBBalance, isMonadTestnet]);

  const canRemoveLiquidity = useMemo(() => {
    if (!isConnected || !selectedPool || !lpTokenAmount) return false;
    if (!isMonadTestnet) return false;
    
    try {
      const lpAmount = parseUnits(lpTokenAmount, 18);
      return lpAmount > 0n && lpAmount <= userLPBalance;
    } catch {
      return false;
    }
  }, [isConnected, selectedPool, lpTokenAmount, userLPBalance, isMonadTestnet]);

  const validationError = useMemo(() => {
    if (!isConnected) return 'Please connect your wallet';
    if (!isMonadTestnet) return 'Please switch to Monad Testnet';
    if (!selectedPool) return 'Please select a pool';
    
    if (tokenAAmount && tokenBAmount) {
      try {
        const amountA = parseUnits(tokenAAmount, selectedPool.tokenA.decimals);
        const amountB = parseUnits(tokenBAmount, selectedPool.tokenB.decimals);
        if (amountA > tokenABalance) return `Insufficient ${selectedPool.tokenA.symbol} balance`;
        if (amountB > tokenBBalance) return `Insufficient ${selectedPool.tokenB.symbol} balance`;
      } catch {
        return 'Invalid amount';
      }
    }
    
    if (lpTokenAmount) {
      try {
        const lpAmount = parseUnits(lpTokenAmount, 18);
        if (lpAmount > userLPBalance) return 'Insufficient LP token balance';
      } catch {
        return 'Invalid LP amount';
      }
    }
    
    return null;
  }, [isConnected, isMonadTestnet, selectedPool, tokenAAmount, tokenBAmount, tokenABalance, tokenBBalance, lpTokenAmount, userLPBalance]);

  return {
    loading,
    error,
    pools,
    selectedPool,
    tokenAAmount,
    tokenBAmount,
    expectedLPTokens,
    poolShare,
    lpTokenAmount,
    expectedTokenA,
    expectedTokenB,
    userLPBalance,
    tokenABalance,
    tokenBBalance,
    selectPool,
    setTokenAAmount,
    setTokenBAmount,
    setLPTokenAmount,
    addLiquidity,
    removeLiquidity,
    refreshPools,
    canAddLiquidity,
    canRemoveLiquidity,
    validationError,
  };
}
