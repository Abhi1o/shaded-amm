"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "viem";
import { useLiquidity } from "@/hooks/useLiquidity";
import { useLiquidityPositions } from "@/hooks/useLiquidityPositions";
import { useAccount } from "wagmi";
import { SlippageSettings } from "@/components/swap/SlippageSettings";
import toast from "react-hot-toast";

type TabType = "add" | "remove" | "positions";

export default function LiquidityPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>("add");
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  const {
    loading,
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
    canAddLiquidity,
    canRemoveLiquidity,
    validationError,
  } = useLiquidity();

  const { positions, hasPositions, loading: positionsLoading } = useLiquidityPositions();

  const handleAddLiquidity = async () => {
    const hash = await addLiquidity(slippageTolerance);
    if (hash) {
      toast.success(`Transaction: ${hash.slice(0, 10)}...`);
    }
  };

  const handleRemoveLiquidity = async () => {
    const hash = await removeLiquidity(slippageTolerance);
    if (hash) {
      toast.success(`Transaction: ${hash.slice(0, 10)}...`);
    }
  };

  const setPercentage = (percent: number) => {
    if (!selectedPool || userLPBalance === 0n) return;
    const amount = (userLPBalance * BigInt(percent)) / 100n;
    setLPTokenAmount(formatUnits(amount, 18));
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <SlippageSettings
        isOpen={showSlippageSettings}
        onClose={() => setShowSlippageSettings(false)}
        currentSlippage={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Liquidity</h1>
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

          {/* Tabs */}
          <div className="flex gap-2 p-1 backdrop-blur-xl bg-white/5 rounded-xl border border-white/10">
            {(["add", "remove", "positions"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  activeTab === tab
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab === "add" && "Add Liquidity"}
                {tab === "remove" && "Remove Liquidity"}
                {tab === "positions" && `Positions ${hasPositions ? `(${positions.length})` : ""}`}
              </button>
            ))}
          </div>

          {/* Main Card */}
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/10">
            {!isConnected ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Connect your wallet to manage liquidity</p>
              </div>
            ) : (
              <>
                {/* Pool Selector */}
                {(activeTab === "add" || activeTab === "remove") && (
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">Select Pool</label>
                    <select
                      value={selectedPool?.address || ""}
                      onChange={(e) => selectPool(e.target.value as any)}
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select a pool...</option>
                      {pools.map((pool) => (
                        <option key={pool.address} value={pool.address}>
                          {pool.pairName} - Shard {pool.shardNumber} (TVL: {formatUnits(pool.reserveA + pool.reserveB, 6).slice(0, 10)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add Liquidity Tab */}
                {activeTab === "add" && selectedPool && (
                  <div className="space-y-4">
                    {/* Token A Input */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-400">{selectedPool.tokenA.symbol}</span>
                        <span className="text-sm text-gray-400">
                          Balance: {formatUnits(tokenABalance, selectedPool.tokenA.decimals).slice(0, 10)}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={tokenAAmount}
                        onChange={(e) => setTokenAAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-transparent text-2xl font-medium focus:outline-none"
                      />
                    </div>

                    {/* Plus Icon */}
                    <div className="flex justify-center">
                      <div className="p-2 bg-white/10 rounded-full">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>

                    {/* Token B Input */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-400">{selectedPool.tokenB.symbol}</span>
                        <span className="text-sm text-gray-400">
                          Balance: {formatUnits(tokenBBalance, selectedPool.tokenB.decimals).slice(0, 10)}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={tokenBAmount}
                        onChange={(e) => setTokenBAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-transparent text-2xl font-medium focus:outline-none"
                      />
                    </div>

                    {/* Expected Output */}
                    {expectedLPTokens > 0n && (
                      <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Expected LP Tokens</span>
                          <span className="text-purple-400">{formatUnits(expectedLPTokens, 18).slice(0, 12)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-gray-400">Share of Pool</span>
                          <span className="text-purple-400">{poolShare.toFixed(4)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Validation Error */}
                    {validationError && (
                      <p className="text-red-400 text-sm text-center">{validationError}</p>
                    )}

                    {/* Add Button */}
                    <button
                      onClick={handleAddLiquidity}
                      disabled={!canAddLiquidity || loading}
                      className={`w-full py-4 rounded-xl font-semibold transition-all ${
                        canAddLiquidity && !loading
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      {loading ? "Processing..." : "Add Liquidity"}
                    </button>
                  </div>
                )}

                {/* Remove Liquidity Tab */}
                {activeTab === "remove" && selectedPool && (
                  <div className="space-y-4">
                    {/* LP Token Balance */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-400">LP Tokens</span>
                        <span className="text-sm text-gray-400">
                          Balance: {formatUnits(userLPBalance, 18).slice(0, 12)}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={lpTokenAmount}
                        onChange={(e) => setLPTokenAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-transparent text-2xl font-medium focus:outline-none"
                      />
                    </div>

                    {/* Percentage Buttons */}
                    <div className="flex gap-2">
                      {[25, 50, 75, 100].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => setPercentage(percent)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>

                    {/* Expected Output */}
                    {(expectedTokenA > 0n || expectedTokenB > 0n) && (
                      <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <p className="text-sm text-gray-400 mb-2">You will receive:</p>
                        <div className="flex justify-between text-sm">
                          <span>{selectedPool.tokenA.symbol}</span>
                          <span className="text-purple-400">
                            {formatUnits(expectedTokenA, selectedPool.tokenA.decimals).slice(0, 12)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span>{selectedPool.tokenB.symbol}</span>
                          <span className="text-purple-400">
                            {formatUnits(expectedTokenB, selectedPool.tokenB.decimals).slice(0, 12)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Validation Error */}
                    {validationError && (
                      <p className="text-red-400 text-sm text-center">{validationError}</p>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={handleRemoveLiquidity}
                      disabled={!canRemoveLiquidity || loading}
                      className={`w-full py-4 rounded-xl font-semibold transition-all ${
                        canRemoveLiquidity && !loading
                          ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      {loading ? "Processing..." : "Remove Liquidity"}
                    </button>
                  </div>
                )}

                {/* No Pool Selected */}
                {(activeTab === "add" || activeTab === "remove") && !selectedPool && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Select a pool to continue</p>
                  </div>
                )}


                {/* Positions Tab */}
                {activeTab === "positions" && (
                  <div className="space-y-4">
                    {positionsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-gray-400">Loading positions...</p>
                      </div>
                    ) : !hasPositions ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">You don't have any liquidity positions yet</p>
                        <button
                          onClick={() => setActiveTab("add")}
                          className="px-6 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all"
                        >
                          Add Liquidity
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {positions.map((position) => (
                          <div
                            key={position.poolAddress}
                            className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <span className="font-semibold">{position.pairName}</span>
                                <span className="text-gray-400 text-sm ml-2">Shard {position.shardNumber}</span>
                              </div>
                              <span className="text-sm text-purple-400">
                                {position.shareOfPool.toFixed(4)}% of pool
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-400">LP Tokens</p>
                                <p className="font-medium">{parseFloat(position.lpTokenBalanceFormatted).toFixed(6)}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Value</p>
                                <p className="font-medium">
                                  {parseFloat(position.tokenAValueFormatted).toFixed(4)} {position.tokenASymbol} +{" "}
                                  {parseFloat(position.tokenBValueFormatted).toFixed(4)} {position.tokenBSymbol}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => {
                                  selectPool(position.poolAddress as any);
                                  setActiveTab("add");
                                }}
                                className="flex-1 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 transition-all"
                              >
                                Add More
                              </button>
                              <button
                                onClick={() => {
                                  selectPool(position.poolAddress as any);
                                  setActiveTab("remove");
                                }}
                                className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pool Info */}
          {selectedPool && (activeTab === "add" || activeTab === "remove") && (
            <div className="backdrop-blur-xl bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Pool Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Pool Address</p>
                  <p className="font-mono text-xs truncate">{selectedPool.address}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total LP Supply</p>
                  <p>{formatUnits(selectedPool.totalSupply, 18).slice(0, 12)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{selectedPool.tokenA.symbol} Reserve</p>
                  <p>{formatUnits(selectedPool.reserveA, selectedPool.tokenA.decimals).slice(0, 12)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{selectedPool.tokenB.symbol} Reserve</p>
                  <p>{formatUnits(selectedPool.reserveB, selectedPool.tokenB.decimals).slice(0, 12)}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
