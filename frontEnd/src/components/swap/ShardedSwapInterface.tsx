"use client";

import React, { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { useShardedDexDirect } from "@/hooks/useShardedDexDirect";
import { useSammBackend } from "@/hooks/useSammBackend";
import { SwapQuote } from "@/lib/shardedDex";
import { TokenIcon } from "@/components/tokens/TokenIcon";
import { TokenBalances } from "./TokenBalances";
import { SwapSuccessModal } from "./SwapSuccessModal";
import { SlippageSettings } from "./SlippageSettings";
import { QuoteAgeProgress } from "./QuoteAgeProgress";
import { ChainIndicator } from "@/components/ui/ChainIndicator";
import { isChainSupported } from "@/config/dex-config-loader";
import toast from "react-hot-toast";

/**
 * Example component showing how to use the Sharded DEX
 * Replace your existing swap interface with this or integrate the logic
 */
export function ShardedSwapInterface() {
  const chainId = useChainId();
  const chainSupported = isChainSupported(chainId);
  
  const {
    tokens,
    loading,
    error,
    isWalletReady,
    isConnected,
    isConnecting,
    walletAddress,
    connect,
    disconnect,
    switchChain,
    getQuote,
    executeSwap,
    getPoolsForPair,
    getPoolsForPairRealTime,
    getTradingPairs,
  } = useShardedDexDirect();



  // Backend API integration for optimal routing
  const {
    getSwapQuote: getBackendQuote,
    isHealthy: backendHealthy,
    fetchShards: fetchBackendShards,
    formatAmount,
    getPriceImpactColor,
  } = useSammBackend();

  const [inputToken, setInputToken] = useState("USDC");
  const [outputToken, setOutputToken] = useState("USDT");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    signature: string;
    inputAmount: number;
    outputAmount: number;
    inputToken: string;
    outputToken: string;
  } | null>(null);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(5.0); // Default 5% - accounts for devnet pool changes

  const [quoteAge, setQuoteAge] = useState(0);
  const [lastQuoteTime, setLastQuoteTime] = useState<number>(0);
  const [realTimePools, setRealTimePools] = useState<any[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [backendQuoteData, setBackendQuoteData] = useState<any>(null);
  const [useBackendRouting, setUseBackendRouting] = useState(true); // Toggle for backend routing
  const [refreshCounter, setRefreshCounter] = useState(0); // Trigger quote refresh

  // Helper function to convert static pool data to display format
  const convertStaticPoolToDisplay = (pool: any) => {
    // Get token info for decimals
    const tokenAInfo = tokens.find(t => t.symbol === pool.tokenASymbol);
    const tokenBInfo = tokens.find(t => t.symbol === pool.tokenBSymbol);

    // Static config has `initialLiquidity` which is in human-readable format (not smallest units)
    // So we can use it directly
    const initialLiq = parseFloat(pool.initialLiquidity || '0');

    return {
      ...pool,
      poolAddress: pool.address,
      liquidityA: initialLiq.toString(),
      liquidityB: initialLiq.toString(),
      dataSource: 'cache',
    };
  };

  // Reset state when chain changes
  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 CHAIN CHANGE DETECTED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Chain ID:', chainId);
    console.log('✅ Chain Supported:', chainSupported);
    console.log('🔗 Expected Chain ID: 10143 (Monad Testnet)');
    console.log('═══════════════════════════════════════════════════════');
    
    setInputAmount("");
    setQuote(null);
    setQuoteAge(0);
    setLastQuoteTime(0);
    setRealTimePools([]);
    setBackendQuoteData(null);
  }, [chainId, chainSupported]);

  // Fetch pool data from BACKEND API (not blockchain) - FIXED!
  useEffect(() => {
    // Only fetch if chain is supported
    if (!chainSupported) {
      setRealTimePools([]);
      setPoolsLoading(false);
      return;
    }

    const fetchPoolsFromBackend = async () => {
      setPoolsLoading(true);
      try {
        // Use backend API if on Monad and backend is healthy
        if (chainId === 10143 && backendHealthy) {
          console.log('🚀 Fetching pools from SAMM Backend API...');
          const shardsData = await fetchBackendShards();
          
          if (shardsData && shardsData.length > 0) {
            // Filter shards for current token pair
            const pairName = `${inputToken}/${outputToken}`;
            const reversePairName = `${outputToken}/${inputToken}`;

            const filteredShards = shardsData.filter((shard: any) =>
              shard.pair === pairName || shard.pair === reversePairName
            );

            // Get token decimals for conversion
            const tokenAInfo = tokens.find(t => t.symbol === inputToken);
            const tokenBInfo = tokens.find(t => t.symbol === outputToken);

            // Convert backend format to component format
            const convertedPools = filteredShards.map((shard: any) => {
              // Backend returns reserves in smallest units - convert to human-readable
              const liquidityA = tokenAInfo
                ? parseFloat(shard.reserves.reserveA) / Math.pow(10, tokenAInfo.decimals)
                : parseFloat(shard.reserves.reserveA);

              const liquidityB = tokenBInfo
                ? parseFloat(shard.reserves.reserveB) / Math.pow(10, tokenBInfo.decimals)
                : parseFloat(shard.reserves.reserveB);

              return {
                poolAddress: shard.address,
                shardNumber: parseInt(shard.name.split('-')[1] || '1'),
                tokenASymbol: inputToken,
                tokenBSymbol: outputToken,
                liquidityA: liquidityA.toString(),
                liquidityB: liquidityB.toString(),
                dataSource: 'backend', // Mark as from backend
              };
            });

            console.log('✅ Loaded', convertedPools.length, 'pools from backend');
            setRealTimePools(convertedPools);
            setPoolsLoading(false);
            return;
          }
        }

        // Fallback to static config data (no blockchain calls!)
        console.log('📊 Using static config data...');
        try {
          const staticPools = getPoolsForPair(inputToken, outputToken);
          const convertedPools = staticPools.map(convertStaticPoolToDisplay);
          setRealTimePools(convertedPools);
        } catch (fallbackError) {
          console.error('Failed to get pools from config:', fallbackError);
          setRealTimePools([]);
        }
      } catch (error) {
        console.error('Failed to fetch pools from backend:', error);
        // Fallback to static data
        try {
          const staticPools = getPoolsForPair(inputToken, outputToken);
          const convertedPools = staticPools.map(convertStaticPoolToDisplay);
          setRealTimePools(convertedPools);
        } catch (fallbackError) {
          setRealTimePools([]);
        }
      } finally {
        setPoolsLoading(false);
      }
    };

    fetchPoolsFromBackend();

    // Auto-refresh pool data every 60 seconds (reduced from 30s)
    const refreshInterval = setInterval(fetchPoolsFromBackend, 60000);
    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputToken, outputToken, chainSupported, chainId, backendHealthy]);

  // Get quote when inputs change - WITH BACKEND INTEGRATION
  useEffect(() => {
    // Don't fetch quotes if chain is not supported
    if (!chainSupported) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }

    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) {
      setQuote(null);
      setQuoteAge(0);
      setLastQuoteTime(0);
      setBackendQuoteData(null);
      return;
    }

    const debounce = setTimeout(async () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log('💱 FETCHING QUOTE');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 Request Details:');
      console.log('  - Chain ID:', chainId);
      console.log('  - Chain Supported:', chainSupported);
      console.log('  - Input Token:', inputToken);
      console.log('  - Output Token:', outputToken);
      console.log('  - Amount:', amount);
      console.log('  - Backend Healthy:', backendHealthy);
      console.log('  - Use Backend Routing:', useBackendRouting);
      
      setQuoteLoading(true);
      try {
        // Try backend routing first if enabled and healthy
        if (useBackendRouting && backendHealthy && chainId === 10143) {
          console.log('🚀 Using SAMM Backend for optimal routing...');
          
          // Get token info
          const inputTokenInfo = tokens.find(t => t.symbol === inputToken);
          const outputTokenInfo = tokens.find(t => t.symbol === outputToken);
          
          console.log('🔍 Token info:', {
            inputToken,
            outputToken,
            inputTokenInfo: inputTokenInfo ? {
              symbol: inputTokenInfo.symbol,
              address: inputTokenInfo.address,
              decimals: inputTokenInfo.decimals
            } : 'NOT FOUND',
            outputTokenInfo: outputTokenInfo ? {
              symbol: outputTokenInfo.symbol,
              address: outputTokenInfo.address,
              decimals: outputTokenInfo.decimals
            } : 'NOT FOUND',
            tokensAvailable: tokens.map(t => ({ symbol: t.symbol, address: t.address }))
          });
          
          if (inputTokenInfo && outputTokenInfo) {
            // Validate token addresses
            if (!inputTokenInfo.address || !outputTokenInfo.address) {
              console.error('❌ Token addresses missing:', {
                inputAddress: inputTokenInfo.address,
                outputAddress: outputTokenInfo.address
              });
              throw new Error('Token addresses not configured');
            }

            // Convert amount to smallest unit
            const amountInSmallestUnit = (amount * Math.pow(10, inputTokenInfo.decimals)).toString();
            
            console.log('💱 Requesting quote from backend:');
            console.log('  - Amount (smallest unit):', amountInSmallestUnit);
            console.log('  - From:', `${inputToken} (${inputTokenInfo.address})`);
            console.log('  - To:', `${outputToken} (${outputTokenInfo.address})`);
            console.log('  - Input Decimals:', inputTokenInfo.decimals);
            console.log('  - Output Decimals:', outputTokenInfo.decimals);
            
            try {
              const backendQuote = await getBackendQuote(
                amountInSmallestUnit,
                inputTokenInfo.address,
                outputTokenInfo.address,
                inputTokenInfo.decimals,
                outputTokenInfo.decimals
              );

              if (backendQuote) {
                console.log('✅ Backend quote received:');
                console.log('  - Pool Address:', backendQuote.poolAddress);
                console.log('  - Pool Name:', backendQuote.poolName);
                console.log('  - Amount In:', backendQuote.amountIn);
                console.log('  - Amount Out:', backendQuote.amountOut);
                console.log('  - Fee:', backendQuote.fee);
                console.log('  - Price Impact:', backendQuote.priceImpact);
                console.log('  - Is Multi-Hop:', backendQuote.isMultiHop);
                if (backendQuote.isMultiHop) {
                  console.log('  - Path:', backendQuote.path);
                  console.log('  - Steps:', backendQuote.steps);
                }

                setBackendQuoteData(backendQuote);

                // Parse amountOut - handle both string and number
                const amountOutRaw = typeof backendQuote.amountOut === 'string'
                  ? parseFloat(backendQuote.amountOut)
                  : backendQuote.amountOut;

                // CRITICAL FIX: For multi-hop swaps, backend returns normalized amounts in input token decimals
                // We need to use input token decimals for conversion, then scale to output token
                const decimalsMismatch = inputTokenInfo.decimals !== outputTokenInfo.decimals;

                let estimatedOutputAmount: number;

                if (backendQuote.isMultiHop && decimalsMismatch) {
                  // Multi-hop with different decimals: backend returns in input token decimals
                  // Convert from input decimals to human-readable
                  const humanReadable = amountOutRaw / Math.pow(10, inputTokenInfo.decimals);
                  estimatedOutputAmount = humanReadable;

                  console.log('🔀 Multi-hop decimal conversion (USDC 6 → DAI 18):');
                  console.log('  - Backend amount (input decimals):', amountOutRaw);
                  console.log('  - Input decimals:', inputTokenInfo.decimals);
                  console.log('  - Output decimals:', outputTokenInfo.decimals);
                  console.log('  - Human-readable amount:', humanReadable);
                } else {
                  // Single-hop or same decimals: use output decimals
                  estimatedOutputAmount = amountOutRaw / Math.pow(10, outputTokenInfo.decimals);
                }

                console.log('💰 Amount conversion:');
                console.log('  - Raw amount out:', backendQuote.amountOut);
                console.log('  - Parsed:', amountOutRaw);
                console.log('  - Output decimals:', outputTokenInfo.decimals);
                console.log('  - Final estimated output:', estimatedOutputAmount);

                // Convert backend quote to SwapQuote format
                // For multi-hop, use the first step's pool address
                const firstPoolAddress = backendQuote.isMultiHop && backendQuote.steps && backendQuote.steps.length > 0
                  ? backendQuote.steps[0].shard
                  : backendQuote.poolAddress || '';

                const convertedQuote: SwapQuote = {
                  inputToken: inputToken,       // Token symbol (USDC, USDT, etc.)
                  outputToken: outputToken,     // Token symbol (USDT, DAI, etc.)
                  inputAmount: amount,
                  estimatedOutput: estimatedOutputAmount,
                  priceImpact: backendQuote.priceImpact,
                  route: [{
                    poolAddress: firstPoolAddress,
                    shardNumber: parseInt(backendQuote.poolName?.split('-')[1] || '1'),
                    inputAmount: amount,
                    outputAmount: estimatedOutputAmount,
                    reserves: {
                      reserve0: '0',    // Backend doesn't provide reserves
                      reserve1: '0',
                    },
                  }],
                  totalFee: parseFloat(backendQuote.fee) / Math.pow(10, inputTokenInfo.decimals),
                  routingMethod: 'backend',
                  // Multi-hop specific fields
                  isMultiHop: backendQuote.isMultiHop,
                  multiHopPath: backendQuote.path,
                  multiHopSteps: backendQuote.steps,
                };

                console.log('✅ Converted quote:', convertedQuote);
                console.log('  - Estimated Output:', convertedQuote.estimatedOutput);
                console.log('═══════════════════════════════════════════════════════');

                setQuote(convertedQuote);
                setLastQuoteTime(Date.now());
                setQuoteAge(0);
                setQuoteLoading(false);
                return;
              } else {
                console.log('⚠️  Backend returned null quote');
              }
            } catch (backendError) {
              console.log('❌ Backend routing failed:');
              console.error('  Error:', backendError);
              console.log('  Falling back to local routing...');
            }
          } else {
            console.log('⚠️  Token info not found, falling back to local routing');
          }
        } else {
          console.log('📊 Skipping backend routing:');
          console.log('  - Use Backend Routing:', useBackendRouting);
          console.log('  - Backend Healthy:', backendHealthy);
          console.log('  - Chain ID:', chainId, '(Expected: 10143)');
        }

        // Fallback to local routing
        console.log('📊 Using local routing...');
        const q = await getQuote(inputToken, outputToken, amount);
        
        if (q) {
          console.log('✅ Local quote received:', q);
        } else {
          console.log('❌ Local quote returned null');
        }
        console.log('═══════════════════════════════════════════════════════');
        
        setQuote(q);
        setBackendQuoteData(null);
        setLastQuoteTime(Date.now());
        setQuoteAge(0);
      } catch (error) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('❌ QUOTE FETCH FAILED');
        console.log('═══════════════════════════════════════════════════════');
        console.error('Error:', error);
        console.log('═══════════════════════════════════════════════════════');
        setQuote(null);
        setBackendQuoteData(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputToken, outputToken, inputAmount, chainSupported, useBackendRouting, backendHealthy, chainId, refreshCounter]);

  // DISABLED: Auto-refresh to prevent RPC rate limiting
  // Backend API provides fresh data on each request
  // User can manually refresh by changing amount

  // Track quote age and auto-refresh when stale (20 seconds)
  useEffect(() => {
    if (!lastQuoteTime || !quote) {
      console.log('⏱️  Quote age tracker: No quote or lastQuoteTime');
      return;
    }

    console.log('⏱️  Quote age tracker started at:', new Date(lastQuoteTime).toLocaleTimeString());

    const ageInterval = setInterval(() => {
      const age = Date.now() - lastQuoteTime;
      setQuoteAge(age);

      // Auto-refresh quote if it's older than 20 seconds
      if (age > 20000 && inputAmount && !quoteLoading) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔄 QUOTE AUTO-REFRESH TRIGGERED');
        console.log('═══════════════════════════════════════════════════════');
        console.log('⏱️  Quote Age:', Math.floor(age / 1000), 'seconds');
        console.log('🔄 Threshold: 20 seconds');
        console.log('💱 Input Amount:', inputAmount);
        console.log('🔄 Triggering fresh quote fetch...');
        console.log('🔄 Resetting age and updating lastQuoteTime...');
        console.log('═══════════════════════════════════════════════════════');

        // Reset age and update quote time immediately
        setQuoteAge(0);
        setLastQuoteTime(Date.now());

        // Trigger a refresh by incrementing the refresh counter
        setRefreshCounter(prev => prev + 1);
      }
    }, 100); // Update age every 100ms

    return () => {
      console.log('⏱️  Quote age tracker stopped');
      clearInterval(ageInterval);
    };
  }, [lastQuoteTime, quote, inputAmount, quoteLoading]);

  // Helper function to convert technical errors to user-friendly messages
  const getUserFriendlyError = (error: Error | unknown): string => {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Wrong chain / pool not found
    if (errorMsg.includes("does not exist on this chain") || 
        errorMsg.includes("Pool") && errorMsg.includes("not on this chain") ||
        errorMsg.includes("PoolNotInitialized") ||
        errorMsg.includes("0xfb8f41b2")) {
      return "Wrong network. Please switch to Monad Testnet";
    }

    // User rejected transaction
    if (errorMsg.includes("User rejected") || errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
      return "Transaction cancelled";
    }

    // Insufficient balance
    if (errorMsg.includes("insufficient") && errorMsg.includes("balance")) {
      return "Insufficient balance for this transaction";
    }

    // Insufficient funds for gas
    if (errorMsg.includes("insufficient funds") || errorMsg.includes("gas")) {
      return "Not enough MON for gas fees";
    }

    // Token not found
    if (errorMsg.includes("Token not found")) {
      return "Token configuration error. Please try again";
    }

    // Slippage exceeded
    if (errorMsg.includes("slippage") || errorMsg.includes("Slippage")) {
      return "Price changed too much. Try increasing slippage tolerance";
    }

    // Network issues
    if (errorMsg.includes("network") || errorMsg.includes("timeout")) {
      return "Network error. Please check your connection";
    }

    // Approval failed
    if (errorMsg.includes("approval") || errorMsg.includes("approve")) {
      return "Token approval failed. Please try again";
    }

    // Generic swap failure
    return "Swap failed. Please try again";
  };

  const handleSwap = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 SWAP BUTTON CLICKED');
    console.log('═══════════════════════════════════════════════════════');
    
    if (!quote) {
      console.log('❌ No quote available');
      console.log('═══════════════════════════════════════════════════════');
      return;
    }

    console.log('📊 Swap Details:');
    console.log('  - Chain ID:', chainId);
    console.log('  - Chain Supported:', chainSupported);
    console.log('  - Wallet Connected:', isConnected);
    console.log('  - Wallet Ready:', isWalletReady);
    console.log('  - Wallet Address:', walletAddress);
    console.log('  - Input Token:', inputToken);
    console.log('  - Output Token:', outputToken);
    console.log('  - Input Amount:', quote.inputAmount);
    console.log('  - Estimated Output:', quote.estimatedOutput);
    console.log('  - Pool Address:', quote.route[0].poolAddress);
    console.log('  - Shard Number:', quote.route[0].shardNumber);
    console.log('  - Backend Quote Data:', backendQuoteData ? 'Yes' : 'No');
    console.log('  - Slippage Tolerance:', slippageTolerance, '%');

    // Validate wallet connection
    if (!isConnected) {
      console.log('❌ Wallet not connected');
      console.log('═══════════════════════════════════════════════════════');
      toast.error("Please connect your wallet first");
      return;
    }

    if (!isWalletReady) {
      console.log('❌ Wallet not ready');
      console.log('  - isConnected:', isConnected);
      console.log('  - isWalletReady:', isWalletReady);
      console.log('═══════════════════════════════════════════════════════');
      toast.error("Wallet is initializing, please wait a moment and try again");
      return;
    }

    // Validate chain before swap
    if (!chainSupported) {
      console.log('❌ Chain not supported');
      console.log('  - Current Chain ID:', chainId);
      console.log('  - Required Chain ID: 10143 (Monad Testnet)');
      console.log('═══════════════════════════════════════════════════════');
      toast.error("Please switch to Monad Testnet to execute swaps");
      return;
    }

    // Check if we need to switch chains
    const targetChainId = 10143; // Monad Testnet
    if (chainId !== targetChainId) {
      console.log('⚠️  Chain mismatch detected');
      console.log('  - Current Chain ID:', chainId);
      console.log('  - Target Chain ID:', targetChainId);
      console.log('  - Attempting automatic chain switch...');
      
      try {
        toast.loading("Switching to Monad Testnet...", { id: 'chain-switch' });
        await switchChain(targetChainId);
        toast.success("Switched to Monad Testnet!", { id: 'chain-switch' });
        console.log('✅ Chain switched successfully');
        
        // Wait a moment for the chain switch to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError: any) {
        console.log('❌ Chain switch failed:', switchError);
        console.log('═══════════════════════════════════════════════════════');
        
        const errorMsg = switchError.message || 'Failed to switch chain';
        if (errorMsg.includes('rejected')) {
          toast.error("You rejected the chain switch request", { id: 'chain-switch' });
        } else {
          toast.error(`Failed to switch chain: ${errorMsg}`, { id: 'chain-switch' });
        }
        return;
      }
    }

    console.log('✅ All validations passed, executing swap...');
    console.log('═══════════════════════════════════════════════════════');

    try {
      const signature = await executeSwap(quote, slippageTolerance);
      
      if (signature) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ SWAP SUCCESSFUL');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📝 Transaction Signature:', signature);
        console.log('═══════════════════════════════════════════════════════');
        
        // Show premium success modal
        setSuccessData({
          signature,
          inputAmount: quote.inputAmount,
          outputAmount: quote.estimatedOutput,
          inputToken,
          outputToken,
        });
        setShowSuccessModal(true);

        // Reset form
        setInputAmount("");
        setQuote(null);
        setBackendQuoteData(null);
      }
    } catch (err) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('❌ SWAP FAILED');
      console.log('═══════════════════════════════════════════════════════');
      console.error('Error Details:', err);
      console.log('Error Message:', err instanceof Error ? err.message : String(err));
      console.log('═══════════════════════════════════════════════════════');
      
      const friendlyError = getUserFriendlyError(err);
      toast.error(friendlyError);
    }
  };

  const handleSwapDirection = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
  };

  // Use real-time pools data instead of static config data
  const pools = realTimePools.length > 0
    ? realTimePools
    : getPoolsForPair(inputToken, outputToken).map(convertStaticPoolToDisplay);
  const pairs = getTradingPairs();

  return (
    <>
      {/* Success Modal */}
      {successData && (
        <SwapSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          signature={successData.signature}
          inputAmount={successData.inputAmount}
          outputAmount={successData.outputAmount}
          inputToken={successData.inputToken}
          outputToken={successData.outputToken}
        />
      )}

      {/* Slippage Settings Modal */}
      <SlippageSettings
        isOpen={showSlippageSettings}
        onClose={() => setShowSlippageSettings(false)}
        currentSlippage={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {/* Left Side - Swap Card */}
        <div>
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-5 sm:p-6 border border-white/10 hover:border-white/20 transition-all shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Swap Tokens</h2>
                {/* <ChainIndicator showDetails={false} />
                
                {chainId === 10143 && (
                  <div className="flex items-center gap-2">
                    {backendHealthy ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Backend API
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                        Local Routing
                      </span>
                    )}
                  </div>
                )} */}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSlippageSettings(true)}
                  className="p-2 backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all group"
                  title="Slippage Settings"
                >
                  <svg
                    className="w-5 h-5 text-gray-300 group-hover:text-white group-hover:rotate-90 transition-all duration-300"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
                
              </div>
            </div>

            

            {/* Unsupported Chain Warning */}
            {!chainSupported && (
              <div className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-yellow-300 font-semibold text-sm mb-1">
                      Unsupported Chain
                    </h4>
                    <p className="text-yellow-200/80 text-xs">
                      Please switch to Monad Testnet to use the DEX.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Wrong Chain Warning (when user is on wrong chain) */}
            {chainSupported && chainId !== 10143 && (
              <div className="backdrop-blur-xl bg-orange-500/20 border border-orange-500/50 rounded-2xl p-4 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-orange-400 shrink-0 mt-0.5"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <h4 className="text-orange-300 font-semibold text-sm mb-1">
                        Wrong Network
                      </h4>
                      <p className="text-orange-200/80 text-xs mb-2">
                        You're on chain {chainId}. Switch to Monad Testnet (10143) to execute swaps.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            toast.loading("Switching to Monad Testnet...", { id: 'chain-switch-btn' });
                            await switchChain(10143);
                            toast.success("Switched to Monad Testnet!", { id: 'chain-switch-btn' });
                          } catch (error: any) {
                            const errorMsg = error.message || 'Failed to switch chain';
                            if (errorMsg.includes('rejected')) {
                              toast.error("You rejected the chain switch request", { id: 'chain-switch-btn' });
                            } else {
                              toast.error(`Failed to switch chain: ${errorMsg}`, { id: 'chain-switch-btn' });
                            }
                          }
                        }}
                        className="px-3 py-1.5 bg-orange-500/30 hover:bg-orange-500/50 text-orange-200 text-xs rounded-lg border border-orange-500/50 transition-all"
                      >
                        Switch to Monad Testnet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Input Token */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                From
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-chakra-petch-regular text-2xl"
                />
                <div className="flex items-center gap-2 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
                  <TokenIcon symbol={inputToken} size="sm" />
                  <select
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer"
                  >
                    {tokens.map((token) => (
                      <option
                        key={token.symbol}
                        value={token.symbol}
                        className="bg-gray-900"
                      >
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center mb-4">
              <button
                onClick={handleSwapDirection}
                className="p-3 backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all hover:scale-110"
              >
                <svg
                  className="w-5 h-5 text-gray-300"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </button>
            </div>

            {/* Output Token */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                To
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quote ? quote.estimatedOutput.toFixed(6) : "0.00"}
                  readOnly
                  placeholder="0.00"
                  className="flex-1 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 font-chakra-petch-regular text-2xl"
                />
                <div className="flex items-center gap-2 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
                  <TokenIcon symbol={outputToken} size="sm" />
                  <select
                    value={outputToken}
                    onChange={(e) => setOutputToken(e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer"
                  >
                    {tokens.map((token) => (
                      <option
                        key={token.symbol}
                        value={token.symbol}
                        className="bg-gray-900"
                      >
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={
                !quote ||
                loading ||
                quoteLoading ||
                !chainSupported ||
                !isConnected ||
                !isWalletReady
              }
              className="w-full py-4 px-6 bg-[#4B39A7] hover:bg-[#5543ae] disabled:bg-gray-600  disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 space-y-2 mb-4"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Swapping...
                </span>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : !isWalletReady ? (
                "Wallet Initializing..."
              ) : !chainSupported ? (
                "Switch to Monad Testnet"
              ) : quote ? (
                "Swap"
              ) : (
                "Enter Amount"
              )}
            </button>

            {/* Quote Information */}
            {quoteLoading && (
              <div className="text-center text-gray-400 my-4 py-4">
                <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-2" />
                <div>Getting quote...</div>
              </div>
            )}

            {quote && !quoteLoading && (
              <>
                <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-white/10 rounded-2xl p-4 mb-4 space-y-2">
                  {/* Backend Routing Indicator */}
                  {backendQuoteData && (
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2 text-xs">
                        
                        <span className="text-gray-400">via {backendQuoteData.poolName}</span>
                        {backendQuoteData.isMultiHop && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                            Multi-Hop: {backendQuoteData.path?.join(' → ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Local Routing Indicator (non-Monad chains) */}
                  {!backendQuoteData && chainId !== 10143 && (
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                          📍 Local Routing
                        </span>
                        <span className="text-gray-400">Direct pool calculation</span>
                      </div>
                    </div>
                  )}

                  {/* Quote Freshness Indicator */}
                  <div className="mb-3 pb-3 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <QuoteAgeProgress quoteAge={quoteAge} maxAge={20000} />
                      <button
                        onClick={() => {
                          console.log('═══════════════════════════════════════════════════════');
                          console.log('🔄 MANUAL QUOTE REFRESH');
                          console.log('═══════════════════════════════════════════════════════');
                          console.log('⏱️  Current Quote Age:', Math.floor(quoteAge / 1000), 'seconds');
                          console.log('🔄 Triggering fresh quote fetch...');
                          console.log('🔄 Resetting age and updating lastQuoteTime...');
                          console.log('═══════════════════════════════════════════════════════');

                          // Reset age and update quote time immediately
                          setQuoteAge(0);
                          setLastQuoteTime(Date.now());

                          // Trigger a refresh
                          setRefreshCounter(prev => prev + 1);
                        }}
                        disabled={quoteLoading}
                        className="p-1 hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                        title="Refresh quote"
                      >
                        <svg
                          className={`w-4 h-4 text-gray-400 hover:text-white transition-all ${quoteLoading ? 'animate-spin' : ''}`}
                          fill="none"
                          strokeWidth="2"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Backend Quote Details */}
                  {backendQuoteData && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Trading Fee:</span>
                      <span className="font-medium text-white">
                        {formatAmount(backendQuoteData.fee, tokens.find(t => t.symbol === inputToken)?.decimals || 6)} {inputToken}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price Impact:</span>
                    <span
                      className={`font-medium ${
                        backendQuoteData 
                          ? getPriceImpactColor(backendQuoteData.priceImpact)
                          : quote.priceImpact > 5
                          ? "text-red-400"
                          : quote.priceImpact > 1
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Using Shard:</span>
                    <span className="font-medium text-white">
                      #{quote.route[0].shardNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rate:</span>
                    <span className="font-medium text-white">
                      1 {inputToken} ={" "}
                      {(quote.estimatedOutput / quote.inputAmount).toFixed(6)}{" "}
                      {outputToken}
                    </span>
                  </div>
                </div>

                {/* Price Impact Warning - Yellow for > 1% */}
                {quote.priceImpact > 1 && quote.priceImpact <= 5 && (
                  <div className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <h4 className="text-yellow-300 font-semibold text-sm mb-1">
                          Moderate Price Impact
                        </h4>
                        <p className="text-yellow-200/80 text-xs">
                          This trade will move the market price by{" "}
                          {quote.priceImpact.toFixed(2)}%. You may receive less
                          favorable rates than expected.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Impact Warning - Red for > 5% */}
                {quote.priceImpact > 5 && (
                  <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/50 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <h4 className="text-red-300 font-semibold text-sm mb-1">
                          High Price Impact Warning
                        </h4>
                        <p className="text-red-200/80 text-xs mb-2">
                          This trade will significantly move the market price by{" "}
                          {quote.priceImpact.toFixed(2)}%. You will receive much
                          less favorable rates. Consider splitting this trade into
                          smaller amounts.
                        </p>
                      </div>
                    </div>

                  </div>
                )}
              </>
            )}

            {/* Wallet Status Warning */}
            {isConnected && !isWalletReady && (
              <div className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5 animate-pulse"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-yellow-300 font-semibold text-sm mb-1">
                      Wallet Initializing
                    </h4>
                    <p className="text-yellow-200/80 text-xs">
                      Your wallet is connecting. Please wait a moment before attempting to swap.
                    </p>
                  </div>
                </div>
              </div>
            )}

            
          </div>
        </div>

        {/* Right Side - Info Card */}
        <div>
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-5 border border-white/10 shadow-2xl sticky top-24">
            {/* Token Balances */}
            <div className="mb-6">
              <TokenBalances tokens={tokens} />
            </div>

            {/* Available Shards */}
            {pools.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Available Shards for {inputToken}/{outputToken}
                  </h3>
                  {poolsLoading && (
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span>Updating...</span>
                    </div>
                  )}
                </div>
                
                {/* Warning if all pools are using cached data */}
                {pools.every((p: any) => p.dataSource === 'cache') && (
                  <div className="mb-3 p-3 backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs text-yellow-200/90">
                        Pools may not be deployed on this chain yet. Showing estimated liquidity from config.
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {pools.map((pool: any, index: number) => (
                    <div
                      key={`${pool.poolAddress}-${pool.shardNumber}-${index}`}
                      className={`text-xs p-3 rounded-2xl backdrop-blur-xl transition-all ${
                        quote && quote.route[0].poolAddress === pool.poolAddress
                          ? "bg-blue-500/20 border border-blue-500/50"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            Shard {pool.shardNumber}
                          </span>
                        </div>
                        {quote &&
                          quote.route[0].poolAddress === pool.poolAddress && (
                            <span className="text-blue-400 font-semibold">
                              ✓ Selected
                            </span>
                          )}
                      </div>
                      <div className="text-gray-400 space-y-1">
                        <div>Liquidity:</div>
                        <div className="text-white font-medium">
                          {parseFloat(pool.liquidityA).toLocaleString()}{" "}
                          {pool.tokenASymbol}
                        </div>
                        <div className="text-white font-medium">
                          {parseFloat(pool.liquidityB).toLocaleString()}{" "}
                          {pool.tokenBSymbol}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trading Pairs */}
            <div
              className={
                pools.length > 0 ? "border-t border-white/10 pt-6" : ""
              }
            >
              <h3 className="text-lg font-bold text-white mb-4">
                Available Trading Pairs
              </h3>
              <div className="flex flex-wrap gap-2">
                {pairs.map((pair) => (
                  <span
                    key={pair.pair}
                    className="px-3 py-2 backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium rounded-full hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                  >
                    {pair.pair}
                    <span className="ml-1 text-blue-400">({pair.shards})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
