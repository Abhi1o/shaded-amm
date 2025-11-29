"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useChainId, useAccount } from "wagmi";
import { useShardedDexDirect } from "@/hooks/useShardedDexDirect";
import { useSammBackend } from "@/hooks/useSammBackend";
import { SwapQuote } from "@/lib/shardedDex";
import { TokenIcon } from "@/components/tokens/TokenIcon";
import { SwapSuccessModal } from "@/components/swap/SwapSuccessModal";
import { SlippageSettings } from "@/components/swap/SlippageSettings";
import { isChainSupported } from "@/config/dex-config-loader";
import toast from "react-hot-toast";

export default function SwapPage() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const chainSupported = isChainSupported(chainId);

  const {
    tokens,
    loading,
    isWalletReady,
    walletAddress,
    switchChain,
    getQuote,
    executeSwap,
    getPoolsForPair,
    getTradingPairs,
  } = useShardedDexDirect();

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
  const [successData, setSuccessData] = useState<any>(null);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(5.0);
  const [backendQuoteData, setBackendQuoteData] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);

  // Reset state when chain changes
  useEffect(() => {
    setInputAmount("");
    setQuote(null);
    setBackendQuoteData(null);
  }, [chainId]);

  // Fetch pools from backend
  useEffect(() => {
    if (!chainSupported) {
      setPools([]);
      return;
    }

    const fetchPools = async () => {
      try {
        if (chainId === 10143 && backendHealthy) {
          const shardsData = await fetchBackendShards();
          if (shardsData && shardsData.length > 0) {
            const pairName = `${inputToken}/${outputToken}`;
            const reversePairName = `${outputToken}/${inputToken}`;
            const filteredShards = shardsData.filter(
              (shard: any) => shard.pair === pairName || shard.pair === reversePairName
            );
            const tokenAInfo = tokens.find((t) => t.symbol === inputToken);
            const tokenBInfo = tokens.find((t) => t.symbol === outputToken);
            const convertedPools = filteredShards.map((shard: any) => ({
              poolAddress: shard.address,
              shardNumber: parseInt(shard.name.split("-")[1] || "1"),
              tokenASymbol: inputToken,
              tokenBSymbol: outputToken,
              liquidityA: tokenAInfo
                ? (parseFloat(shard.reserves.reserveA) / Math.pow(10, tokenAInfo.decimals)).toString()
                : shard.reserves.reserveA,
              liquidityB: tokenBInfo
                ? (parseFloat(shard.reserves.reserveB) / Math.pow(10, tokenBInfo.decimals)).toString()
                : shard.reserves.reserveB,
              dataSource: "backend",
            }));
            setPools(convertedPools);
            return;
          }
        }
        const staticPools = getPoolsForPair(inputToken, outputToken);
        setPools(staticPools.map((p: any) => ({ ...p, poolAddress: p.address, dataSource: "cache" })));
      } catch {
        setPools([]);
      }
    };

    fetchPools();
  }, [inputToken, outputToken, chainSupported, chainId, backendHealthy, tokens, fetchBackendShards, getPoolsForPair]);

  // Get quote when inputs change
  useEffect(() => {
    if (!chainSupported) {
      setQuote(null);
      return;
    }

    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) {
      setQuote(null);
      setBackendQuoteData(null);
      return;
    }

    const debounce = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        if (backendHealthy && chainId === 10143) {
          const inputTokenInfo = tokens.find((t) => t.symbol === inputToken);
          const outputTokenInfo = tokens.find((t) => t.symbol === outputToken);

          if (inputTokenInfo && outputTokenInfo && inputTokenInfo.address && outputTokenInfo.address) {
            const amountInSmallestUnit = (amount * Math.pow(10, inputTokenInfo.decimals)).toString();
            const backendQuote = await getBackendQuote(
              amountInSmallestUnit,
              inputTokenInfo.address,
              outputTokenInfo.address,
              inputTokenInfo.decimals,
              outputTokenInfo.decimals
            );

            if (backendQuote) {
              setBackendQuoteData(backendQuote);
              const amountOutRaw = typeof backendQuote.amountOut === "string" ? parseFloat(backendQuote.amountOut) : backendQuote.amountOut;
              const decimalsMismatch = inputTokenInfo.decimals !== outputTokenInfo.decimals;
              let estimatedOutputAmount = backendQuote.isMultiHop && decimalsMismatch
                ? amountOutRaw / Math.pow(10, inputTokenInfo.decimals)
                : amountOutRaw / Math.pow(10, outputTokenInfo.decimals);

              const firstPoolAddress = backendQuote.isMultiHop && backendQuote.steps && backendQuote.steps.length > 0
                ? backendQuote.steps[0].shard
                : backendQuote.poolAddress || "";

              const convertedQuote: SwapQuote = {
                inputToken,
                outputToken,
                inputAmount: amount,
                estimatedOutput: estimatedOutputAmount,
                priceImpact: backendQuote.priceImpact,
                route: [{
                  poolAddress: firstPoolAddress,
                  shardNumber: parseInt(backendQuote.poolName?.split("-")[1] || "1"),
                  inputAmount: amount,
                  outputAmount: estimatedOutputAmount,
                  reserves: { reserve0: "0", reserve1: "0" },
                }],
                totalFee: parseFloat(backendQuote.fee) / Math.pow(10, inputTokenInfo.decimals),
                routingMethod: "backend",
                isMultiHop: backendQuote.isMultiHop,
                multiHopPath: backendQuote.path,
                multiHopSteps: backendQuote.steps,
              };

              setQuote(convertedQuote);
              setQuoteLoading(false);
              return;
            }
          }
        }

        const q = await getQuote(inputToken, outputToken, amount);
        setQuote(q);
        setBackendQuoteData(null);
      } catch {
        setQuote(null);
        setBackendQuoteData(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [inputToken, outputToken, inputAmount, chainSupported, backendHealthy, chainId, tokens, getBackendQuote, getQuote]);

  const handleSwap = async () => {
    if (!quote || !isConnected || !isWalletReady) return;

    if (chainId !== 10143) {
      try {
        toast.loading("Switching to Monad Testnet...", { id: "chain-switch" });
        await switchChain(10143);
        toast.success("Switched to Monad Testnet!", { id: "chain-switch" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        toast.error(err.message?.includes("rejected") ? "Chain switch rejected" : "Failed to switch chain", { id: "chain-switch" });
        return;
      }
    }

    try {
      const signature = await executeSwap(quote, slippageTolerance);
      if (signature) {
        setSuccessData({
          signature,
          inputAmount: quote.inputAmount,
          outputAmount: quote.estimatedOutput,
          inputToken,
          outputToken,
        });
        setShowSuccessModal(true);
        setInputAmount("");
        setQuote(null);
        setBackendQuoteData(null);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("rejected") || msg.includes("denied")) {
        toast.error("Transaction cancelled");
      } else if (msg.includes("insufficient")) {
        toast.error("Insufficient balance");
      } else {
        toast.error("Swap failed. Please try again.");
      }
    }
  };

  const handleSwapDirection = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
  };

  const pairs = getTradingPairs();

  return (
    <main className="min-h-screen bg-black text-white">
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

      <SlippageSettings
        isOpen={showSlippageSettings}
        onClose={() => setShowSlippageSettings(false)}
        currentSlippage={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
      />

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Swap</h1>
            <button
              onClick={() => setShowSlippageSettings(true)}
              className="p-2 backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all"
              title="Slippage Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Chain Warning */}
          {!chainSupported && (
            <div className="backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-yellow-300 font-semibold text-sm">Unsupported Chain</p>
                  <p className="text-yellow-200/80 text-xs">Please switch to Monad Testnet to use the DEX.</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Swap Card */}
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-4 border border-white/10">
            {!isConnected ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Connect your wallet to swap tokens</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* From Token */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">From</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="number"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      placeholder="0.0"
                      style={{ outline: 'none', boxShadow: 'none' }}
                      className="w-0 flex-1 min-w-0 bg-transparent text-4xl font-chakra-petch-medium !outline-none !border-none !ring-0 focus:!outline-none focus:!border-none focus:!ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex items-center gap-2 px-1 py-1 bg-white/5 border border-white/10 rounded-3xl shrink-0">
                      <TokenIcon symbol={inputToken} size="sm" />
                      <select
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        className="bg-transparent text-white outline-none border-none cursor-pointer"
                      >
                        {tokens.map((token) => (
                          <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Swap Direction Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleSwapDirection}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* To Token */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">To</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={quote ? quote.estimatedOutput.toFixed(4) : "0.0"}
                      readOnly
                      placeholder="0.0"
                      style={{ outline: 'none', boxShadow: 'none' }}
                      className="w-0 flex-1 min-w-0 bg-transparent text-4xl font-chakra-petch-medium !outline-none !border-none !ring-0 focus:!outline-none focus:!border-none focus:!ring-0"
                    />
                    <div className="flex items-center gap-2 px-1 py-1 bg-white/5 border border-white/10 rounded-4xl shrink-0">
                      <TokenIcon symbol={outputToken} size="sm" />
                      <select
                        value={outputToken}
                        onChange={(e) => setOutputToken(e.target.value)}
                        className="bg-transparent text-white outline-none border-none cursor-pointer"
                      >
                        {tokens.map((token) => (
                          <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quote Loading */}
                {quoteLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Getting quote...</p>
                  </div>
                )}

                {/* Quote Details */}
                {quote && !quoteLoading && (
                  <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-2">
                    {backendQuoteData?.isMultiHop && (
                      <div className="flex items-center gap-2 text-xs mb-2 pb-2 border-b border-white/10">
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                          Multi-Hop: {backendQuoteData.path?.join(" → ")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Rate</span>
                      <span className="text-white">
                        1 {inputToken} = {(quote.estimatedOutput / quote.inputAmount).toFixed(4)} {outputToken}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Price Impact</span>
                      <span className={quote.priceImpact > 5 ? "text-red-400" : quote.priceImpact > 1 ? "text-yellow-400" : "text-green-400"}>
                        {quote.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Using Shard</span>
                      <span className="text-white">#{quote.route[0].shardNumber}</span>
                    </div>
                    {backendQuoteData && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Trading Fee</span>
                        <span className="text-white">
                          {formatAmount(backendQuoteData.fee, tokens.find((t) => t.symbol === inputToken)?.decimals || 6)} {inputToken}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price Impact Warning */}
                {quote && quote.priceImpact > 5 && (
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <p className="text-red-400 text-sm">
                      ⚠️ High price impact ({quote.priceImpact.toFixed(2)}%). Consider splitting into smaller trades.
                    </p>
                  </div>
                )}

                {/* Swap Button */}
                <button
                  onClick={handleSwap}
                  disabled={!quote || loading || quoteLoading || !chainSupported || !isWalletReady}
                  className={`w-full py-4 rounded-xl font-semibold transition-all ${
                    quote && !loading && !quoteLoading && chainSupported && isWalletReady
                      ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Swapping..." : !isWalletReady ? "Wallet Initializing..." : !chainSupported ? "Switch to Monad" : quote ? "Swap" : "Enter Amount"}
                </button>
              </div>
            )}
          </div>

          {/* Available Shards */}
          {pools.length > 0 && (
            <div className="backdrop-blur-xl bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Available Shards for {inputToken}/{outputToken}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {pools.map((pool: any, index: number) => (
                  <div
                    key={`${pool.poolAddress}-${index}`}
                    className={`p-3 rounded-xl border transition-all ${
                      quote && quote.route[0].poolAddress === pool.poolAddress
                        ? "bg-purple-500/20 border-purple-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">Shard {pool.shardNumber}</span>
                      {quote && quote.route[0].poolAddress === pool.poolAddress && (
                        <span className="text-purple-400 text-xs">✓ Selected</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      <p>{parseFloat(pool.liquidityA || "0").toLocaleString()} {pool.tokenASymbol}</p>
                      <p>{parseFloat(pool.liquidityB || "0").toLocaleString()} {pool.tokenBSymbol}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trading Pairs */}
          <div className="backdrop-blur-xl bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Available Trading Pairs</h3>
            <div className="flex flex-wrap gap-2">
              {pairs.map((pair) => (
                <span
                  key={pair.pair}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 text-xs rounded-full hover:bg-white/10 transition-all cursor-pointer"
                >
                  {pair.pair} <span className="text-purple-400">({pair.shards})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>High-Performance EVM DEX</p>
            <p>Powered by Monad Testnet</p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
