/**
 * Test utility for Sharded DEX integration - EVM Version
 * Run this to verify your pools are accessible on EVM chains
 */

import { createPublicClient, http } from 'viem';
import { ShardedDexService } from './shardedDex';
import { getDexConfig } from '../config/dex-config-loader';
import { MONAD_TESTNET } from '../config/evm-networks';

export async function testPoolConnection() {
  console.log('🔍 Testing Sharded DEX Connection (EVM)...\n');

  const chainId = MONAD_TESTNET.chainId;
  const config = getDexConfig(chainId);

  if (!config) {
    console.log('❌ No configuration found for chain', chainId);
    return;
  }

  console.log(`Chain ID: ${chainId}`);
  console.log(`Chain Name: ${MONAD_TESTNET.name}`);
  console.log(`RPC URL: ${MONAD_TESTNET.rpcUrls[0]}`);
  console.log(`Total Pools: ${config.pools.length}\n`);

  // Create public client
  const publicClient = createPublicClient({
    chain: {
      id: chainId,
      name: MONAD_TESTNET.name,
      nativeCurrency: MONAD_TESTNET.nativeCurrency,
      rpcUrls: {
        default: { http: MONAD_TESTNET.rpcUrls },
        public: { http: MONAD_TESTNET.rpcUrls },
      },
    },
    transport: http(MONAD_TESTNET.rpcUrls[0]),
  });

  // Create DEX service
  const dexService = new ShardedDexService(publicClient, chainId);

  console.log('📊 Testing Pool Accounts...\n');

  // Test first 3 pools
  for (const pool of config.pools.slice(0, 3)) {
    console.log(`Pool ${pool.tokenASymbol}/${pool.tokenBSymbol} Shard ${pool.shardNumber}:`);
    console.log(`  Address: ${pool.address}`);

    try {
      // Check if pool contract exists
      const code = await publicClient.getBytecode({ 
        address: pool.address as `0x${string}` 
      });

      if (code && code !== '0x') {
        console.log(`  ✅ Pool contract exists (${code.length} bytes)`);
      } else {
        console.log('  ❌ Pool contract not found');
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }
    console.log('');
  }

  // Test quote calculation
  console.log('📈 Testing Quote Calculation...\n');
  try {
    const quote = await dexService.getQuote('USDC', 'USDT', 100);

    console.log('✅ Quote calculated successfully:');
    console.log(`   Input: ${quote.inputAmount} USDC`);
    console.log(`   Output: ~${quote.estimatedOutput.toFixed(4)} USDT`);
    console.log(`   Price Impact: ${quote.priceImpact.toFixed(2)}%`);
    console.log(`   Using Shard: ${quote.route[0].shardNumber}`);
    console.log(`   Fee: ${quote.totalFee.toFixed(6)} USDC`);
    console.log(`   Routing Method: ${quote.routingMethod}`);
  } catch (error) {
    console.error('❌ Quote calculation failed:', error);
  }

  console.log('\n✨ Test complete!');
}

// Browser-compatible test function
export async function testInBrowser() {
  if (typeof window === 'undefined') {
    console.log('This function is for browser testing only');
    return;
  }

  console.log('🌐 Running browser test...');
  await testPoolConnection();
}
