/**
 * Monad Testnet Token Faucet
 * Sends test tokens (USDC, USDT, DAI) to a wallet on Monad Testnet
 *
 * Usage: npx hardhat run scripts/faucet-monad.js --network monad
 */

const { ethers } = require('hardhat');
require('dotenv').config();

// Your wallet address
const TARGET_ADDRESS = '0x0fB795cFC581666932aBAFE438BD3cE6702Da69C';

// Token addresses on Monad Testnet
const MONAD_TOKENS = {
  USDC: '0x9153bc242a5FD22b149B1cb252e3eE6314C37366',
  USDT: '0x39f0B52190CeA4B3569D5D501f0c637892F52379',
  DAI: '0xccA96CacCd9785f32C1ea02D688bc013D43D9f46'
};

async function main() {
  console.log('🚀 Monad Testnet Token Faucet');
  console.log('='.repeat(70));
  console.log(`Target wallet: ${TARGET_ADDRESS}`);
  console.log('');

  try {
    // Get signer (deployer)
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer address: ${deployer.address}`);

    // Check deployer MON balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer MON balance: ${ethers.formatEther(balance)} MON`);
    console.log('');

    // Send tokens
    console.log('📤 Minting and sending test tokens...');
    console.log('');

    for (const [symbol, address] of Object.entries(MONAD_TOKENS)) {
      console.log(`Processing ${symbol}...`);

      try {
        // Get token contract
        const token = await ethers.getContractAt('MockERC20', address);
        const decimals = await token.decimals();

        // Amount to send (10,000 tokens)
        const amount = ethers.parseUnits('10000', decimals);

        console.log(`  Token address: ${address}`);
        console.log(`  Decimals: ${decimals}`);
        console.log(`  Amount: ${ethers.formatUnits(amount, decimals)} ${symbol}`);

        // Check current balance
        const currentBalance = await token.balanceOf(TARGET_ADDRESS);
        console.log(`  Current balance: ${ethers.formatUnits(currentBalance, decimals)} ${symbol}`);

        // Mint tokens to target address
        console.log(`  Minting tokens...`);
        const mintTx = await token.mint(TARGET_ADDRESS, amount);
        console.log(`  Transaction hash: ${mintTx.hash}`);

        // Wait for confirmation
        await mintTx.wait();

        // Verify new balance
        const newBalance = await token.balanceOf(TARGET_ADDRESS);
        console.log(`  ✅ New balance: ${ethers.formatUnits(newBalance, decimals)} ${symbol}`);
        console.log('');

      } catch (error) {
        console.error(`  ❌ Error with ${symbol}: ${error.message}`);
        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('✅ Faucet complete!');
    console.log('');
    console.log('Check your wallet at:');
    console.log(`https://monad-testnet.socialscan.io/address/${TARGET_ADDRESS}`);
    console.log('');

  } catch (error) {
    console.error('❌ Faucet error:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
