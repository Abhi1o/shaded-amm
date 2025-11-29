#!/usr/bin/env node
/**
 * Check wallet balance and mint test tokens if needed
 * Usage: node scripts/check-balance.js [wallet-address]
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

const dexConfig = JSON.parse(fs.readFileSync('src/config/dex-config.json', 'utf8'));
const connection = new Connection(dexConfig.rpcUrl, 'confirmed');

async function checkBalance(walletAddress) {
  const wallet = new PublicKey(walletAddress);
  
  console.log('🔍 Checking balances for wallet:', walletAddress);
  console.log('='.repeat(70));
  console.log('');

  // Check SOL balance
  try {
    const solBalance = await connection.getBalance(wallet);
    console.log(`💰 SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
  } catch (err) {
    console.error('❌ Error fetching SOL balance:', err.message);
  }
  console.log('');

  // Check token balances
  console.log('🪙 Token Balances:');
  console.log('-'.repeat(70));
  
  for (const token of dexConfig.tokens) {
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(token.mint),
        wallet,
        false,
        TOKEN_PROGRAM_ID
      );

      console.log(`\n${token.symbol} (${token.name})`);
      console.log(`  Mint: ${token.mint}`);
      console.log(`  ATA:  ${ata.toBase58()}`);

      try {
        const account = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
        const balance = Number(account.amount) / Math.pow(10, token.decimals);
        
        if (balance > 0) {
          console.log(`  ✅ Balance: ${balance.toLocaleString()} ${token.symbol}`);
        } else {
          console.log(`  ⚠️  Balance: 0 ${token.symbol} (account exists but empty)`);
        }
      } catch (err) {
        if (err.message.includes('could not find account')) {
          console.log(`  ❌ Account does not exist`);
          console.log(`  💡 You need to create this token account and mint tokens`);
        } else {
          console.log(`  ❌ Error: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error checking ${token.symbol}:`, err.message);
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('');
  console.log('📝 Next Steps:');
  console.log('');
  console.log('If you have zero balances:');
  console.log('1. Get SOL from: https://faucet.solana.com/');
  console.log('2. Run the mint script to create test tokens:');
  console.log('   node scripts/mint-test-tokens.js [your-wallet-address] [amount]');
  console.log('');
  console.log('Example:');
  console.log(`   node scripts/mint-test-tokens.js ${walletAddress} 1000`);
  console.log('');
}

// Get wallet address from command line or use default
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Error: Please provide a wallet address');
  console.log('');
  console.log('Usage: node scripts/check-balance.js [wallet-address]');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/check-balance.js HzkaW8LY5uDaDpSvEscSEcrTnngSgwAvsQZzVzCk6TvX');
  process.exit(1);
}

checkBalance(walletAddress).catch(console.error);
