'use client';

import React, { useState } from 'react';
import { useShardedDex } from '@/hooks/useShardedDex';
import { Connection, PublicKey } from '@solana/web3.js';
import dexConfig from '@/config/dex-config.json';

export default function TestDexPage() {
  const { tokens, getTradingPairs, getPoolsForPair } = useShardedDex();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    const results: any[] = [];
    const connection = new Connection(dexConfig.rpcUrl, 'confirmed');

    // Test 1: Program account
    results.push({ test: 'Program Account', status: 'testing' });
    try {
      const programId = new PublicKey(dexConfig.programId);
      const programInfo = await connection.getAccountInfo(programId);
      results[0] = {
        test: 'Program Account',
        status: programInfo ? 'pass' : 'fail',
        details: programInfo ? `Found (${programInfo.data.length} bytes)` : 'Not found'
      };
    } catch (error) {
      results[0] = {
        test: 'Program Account',
        status: 'fail',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    setTestResults([...results]);

    // Test 2: First pool
    results.push({ test: 'Pool Accounts', status: 'testing' });
    try {
      const pool = dexConfig.pools[0];
      const poolPubkey = new PublicKey(pool.poolAddress);
      const poolInfo = await connection.getAccountInfo(poolPubkey);

      results[1] = {
        test: 'Pool Accounts',
        status: poolInfo ? 'pass' : 'fail',
        details: poolInfo ? `Pool ${pool.tokenASymbol}/${pool.tokenBSymbol} found` : 'Pool not found'
      };
    } catch (error) {
      results[1] = {
        test: 'Pool Accounts',
        status: 'fail',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    setTestResults([...results]);

    // Test 3: Quote calculation
    results.push({ test: 'Quote Calculation', status: 'testing' });
    try {
      const { shardedDex } = await import('@/lib/shardedDex');
      const quote = await shardedDex.getQuote('USDC', 'SOL', 100);

      results[2] = {
        test: 'Quote Calculation',
        status: 'pass',
        details: `100 USDC → ${quote.estimatedOutput.toFixed(4)} SOL (Shard ${quote.route[0].shardNumber})`
      };
    } catch (error) {
      results[2] = {
        test: 'Quote Calculation',
        status: 'fail',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    setTestResults([...results]);

    // Test 4: Token accounts
    results.push({ test: 'Token Accounts', status: 'testing' });
    try {
      const pool = dexConfig.pools[0];
      const tokenAAccount = new PublicKey(pool.tokenAccountA);
      const tokenBAccount = new PublicKey(pool.tokenAccountB);

      const [tokenAInfo, tokenBInfo] = await Promise.all([
        connection.getAccountInfo(tokenAAccount),
        connection.getAccountInfo(tokenBAccount)
      ]);

      results[3] = {
        test: 'Token Accounts',
        status: tokenAInfo && tokenBInfo ? 'pass' : 'fail',
        details: `Token A: ${tokenAInfo ? '✓' : '✗'}, Token B: ${tokenBInfo ? '✓' : '✗'}`
      };
    } catch (error) {
      results[3] = {
        test: 'Token Accounts',
        status: 'fail',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    setTestResults([...results]);

    setTesting(false);
  };

  const pairs = getTradingPairs();

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_50%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-6 sm:p-8 mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Sharded DEX Test Suite
          </h1>
          <p className="text-gray-400 mb-8 font-light">Verify your DEX integration is working correctly</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
              <div className="text-sm text-blue-300 font-medium">Network</div>
              <div className="text-lg font-bold text-white">Solana Devnet</div>
            </div>
            <div className="backdrop-blur-xl bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <div className="text-sm text-green-300 font-medium">Tokens</div>
              <div className="text-lg font-bold text-white">{tokens.length} Tokens</div>
            </div>
            <div className="backdrop-blur-xl bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
              <div className="text-sm text-purple-300 font-medium">Pools</div>
              <div className="text-lg font-bold text-white">{dexConfig.pools.length} Pools</div>
            </div>
          </div>

          <button
            onClick={runTests}
            disabled={testing}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100"
          >
            {testing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running Tests...
              </span>
            ) : 'Run Tests'}
          </button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-6 sm:p-8 mb-6">
            <h2 className="text-xl font-bold text-white mb-6">Test Results</h2>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-2xl border backdrop-blur-xl transition-all ${
                    result.status === 'pass'
                      ? 'bg-green-500/20 border-green-500/50'
                      : result.status === 'fail'
                      ? 'bg-red-500/20 border-red-500/50'
                      : 'bg-gray-500/20 border-gray-500/50 animate-pulse'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{result.test}</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        result.status === 'pass'
                          ? 'bg-green-500/30 text-green-300'
                          : result.status === 'fail'
                          ? 'bg-red-500/30 text-red-300'
                          : 'bg-gray-500/30 text-gray-300'
                      }`}
                    >
                      {result.status.toUpperCase()}
                    </span>
                  </div>
                  {result.details && (
                    <div className="mt-2 text-sm text-gray-300">{result.details}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration Info */}
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-gray-400">Program ID:</span>
              <span className="font-mono text-white">{dexConfig.programId}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-gray-400">RPC URL:</span>
              <span className="font-mono text-white">{dexConfig.rpcUrl}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-400">Deployed:</span>
              <span className="text-white">{new Date(dexConfig.deployedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Trading Pairs */}
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Trading Pairs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pairs.map((pair) => {
              const pools = getPoolsForPair(pair.pair.split('/')[0], pair.pair.split('/')[1]);
              return (
                <div key={pair.pair} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-white/20 transition-all">
                  <div className="font-bold text-white mb-2">{pair.pair}</div>
                  <div className="text-sm text-gray-400 mb-3">{pair.shards} Shards</div>
                  <div className="space-y-1">
                    {pools.map((pool) => (
                      <div key={pool.poolAddress} className="text-xs text-gray-500">
                        Shard {pool.shardNumber}: {parseFloat(pool.liquidityA).toLocaleString()} / {parseFloat(pool.liquidityB).toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supported Tokens */}
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-6">Supported Tokens</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tokens.map((token) => (
              <div key={token.symbol} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all">
                <div className="text-2xl font-bold text-white">{token.symbol}</div>
                <div className="text-sm text-gray-400 mt-1">{token.name}</div>
                <div className="text-xs text-gray-500 mt-2 font-mono">{token.decimals} decimals</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
