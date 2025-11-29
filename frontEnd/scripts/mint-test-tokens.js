#!/usr/bin/env node
/**
 * Mint test tokens to a wallet
 * Usage: node scripts/mint-test-tokens.js [wallet-address] [amount]
 */

const {
  Connection,
  PublicKey,
  Keypair,
} = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');

const dexConfig = JSON.parse(fs.readFileSync('src/config/dex-config.json', 'utf8'));
const connection = new Connection(dexConfig.rpcUrl, 'confirmed');

// Load payer keypair
const walletPath = `${os.homedir()}/.config/solana/id.json`;
let payer;
try {
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('✅ Loaded payer wallet:', payer.publicKey.toBase58());
} catch (err) {
  console.error('❌ Error loading payer wallet from', walletPath);
  console.error('   Make sure you have a Solana wallet configured');
  console.error('   Run: solana-keygen new');
  process.exit(1);
}

async function mintTestTokens(recipientAddress, amount) {
  const recipient = new PublicKey(recipientAddress);
  
  console.log('');
  console.log('🪙 Minting Test Tokens');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Recipient: ${recipientAddress}`);
  console.log(`Amount: ${amount} tokens (each)`);
  console.log('');

  // Check SOL balance first
  const solBalance = await connection.getBalance(payer.publicKey);
  console.log(`Payer SOL balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
  
  if (solBalance < 0.1e9) {
    console.error('');
    console.error('❌ Insufficient SOL for transaction fees');
    console.error('   Get SOL from: https://faucet.solana.com/');
    process.exit(1);
  }
  console.log('');

  // Mint each token
  for (const token of dexConfig.tokens) {
    console.log(`Minting ${token.symbol}...`);
    
    try {
      // Get or create recipient's token account
      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        new PublicKey(token.mint),
        recipient,
        false,
        'confirmed',
        { commitment: 'confirmed' },
        TOKEN_PROGRAM_ID
      );

      console.log(`  Token account: ${recipientTokenAccount.address.toBase58()}`);

      // Calculate amount in base units
      const amountInBaseUnits = amount * Math.pow(10, token.decimals);

      // Mint tokens
      const signature = await mintTo(
        connection,
        payer,
        new PublicKey(token.mint),
        recipientTokenAccount.address,
        payer,
        amountInBaseUnits,
        [],
        { commitment: 'confirmed' },
        TOKEN_PROGRAM_ID
      );

      console.log(`  ✅ Minted ${amount} ${token.symbol}`);
      console.log(`  TX: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      console.log('');

      // Wait a bit between mints
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`  ❌ Error minting ${token.symbol}:`, err.message);
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('✅ Done! Check your wallet balances:');
  console.log(`   node scripts/check-balance.js ${recipientAddress}`);
  console.log('');
}

// Get arguments
const recipientAddress = process.argv[2];
const amount = parseFloat(process.argv[3]) || 1000;

if (!recipientAddress) {
  console.error('❌ Error: Please provide a recipient wallet address');
  console.log('');
  console.log('Usage: node scripts/mint-test-tokens.js [wallet-address] [amount]');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/mint-test-tokens.js HzkaW8LY5uDaDpSvEscSEcrTnngSgwAvsQZzVzCk6TvX 1000');
  console.log('');
  console.log('This will mint 1000 of each token (USDC, SOL, USDT, ETH) to the wallet');
  process.exit(1);
}

mintTestTokens(recipientAddress, amount).catch(console.error);
