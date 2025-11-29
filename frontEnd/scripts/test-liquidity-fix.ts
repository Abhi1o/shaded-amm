/**
 * Test script for liquidity smart contract fix
 * 
 * This script tests the corrected discriminators and account orders for:
 * - Add liquidity (discriminator 2)
 * - Remove liquidity (discriminator 3)
 * 
 * Run with: npx ts-node scripts/test-liquidity-fix.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  createAddLiquidityInstruction,
  createRemoveLiquidityInstruction,
  INSTRUCTION_DISCRIMINATORS,
} from '../src/lib/solana/poolInstructions';
import dexConfig from '../src/config/dex-config.json';

// Test configuration
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.net';
const TEST_POOL_INDEX = 0; // Use first pool from config

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  error?: string;
}

class LiquidityTester {
  private connection: Connection;
  private results: TestResult[] = [];

  constructor() {
    this.connection = new Connection(DEVNET_RPC, 'confirmed');
  }

  /**
   * Test 1: Verify instruction discriminators are correct
   */
  async testDiscriminators(): Promise<void> {
    console.log('\n📋 Test 1: Verify Instruction Discriminators');
    console.log('='.repeat(60));

    try {
      // Check discriminator values
      const tests = [
        { name: 'INITIALIZE', expected: 0, actual: INSTRUCTION_DISCRIMINATORS.INITIALIZE },
        { name: 'SWAP', expected: 1, actual: INSTRUCTION_DISCRIMINATORS.SWAP },
        { name: 'ADD_LIQUIDITY', expected: 2, actual: INSTRUCTION_DISCRIMINATORS.ADD_LIQUIDITY },
        { name: 'REMOVE_LIQUIDITY', expected: 3, actual: INSTRUCTION_DISCRIMINATORS.REMOVE_LIQUIDITY },
        { name: 'ADD_SINGLE', expected: 4, actual: INSTRUCTION_DISCRIMINATORS.ADD_SINGLE },
        { name: 'REMOVE_SINGLE', expected: 5, actual: INSTRUCTION_DISCRIMINATORS.REMOVE_SINGLE },
      ];

      let allPassed = true;
      for (const test of tests) {
        const passed = test.expected === test.actual;
        allPassed = allPassed && passed;
        
        console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${test.actual} (expected ${test.expected})`);
        
        this.results.push({
          test: `Discriminator ${test.name}`,
          passed,
          details: `Value: ${test.actual}, Expected: ${test.expected}`,
        });
      }

      if (allPassed) {
        console.log('\n✅ All discriminators are correct!');
      } else {
        console.log('\n❌ Some discriminators are incorrect!');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      this.results.push({
        test: 'Discriminator verification',
        passed: false,
        details: 'Failed to verify discriminators',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 2: Verify instruction data format for add liquidity
   */
  async testAddLiquidityInstructionData(): Promise<void> {
    console.log('\n📋 Test 2: Verify Add Liquidity Instruction Data Format');
    console.log('='.repeat(60));

    try {
      const poolConfig = dexConfig.pools[TEST_POOL_INDEX];
      const programId = new PublicKey(dexConfig.programId);
      const poolAddress = new PublicKey(poolConfig.poolAddress);
      const poolAuthority = new PublicKey(poolConfig.authority);
      const poolTokenAccountA = new PublicKey(poolConfig.tokenAccountA);
      const poolTokenAccountB = new PublicKey(poolConfig.tokenAccountB);
      const lpTokenMint = new PublicKey(poolConfig.poolTokenMint);
      const feeAccount = new PublicKey(poolConfig.feeAccount);
      const tokenAMint = new PublicKey(poolConfig.tokenA);
      const tokenBMint = new PublicKey(poolConfig.tokenB);

      // Create dummy user accounts for testing
      const dummyUser = Keypair.generate().publicKey;
      const userTokenA = await getAssociatedTokenAddress(tokenAMint, dummyUser);
      const userTokenB = await getAssociatedTokenAddress(tokenBMint, dummyUser);
      const userLpToken = await getAssociatedTokenAddress(lpTokenMint, dummyUser);

      // Test amounts
      const amountA = BigInt(1_000_000_000); // 1 token A
      const amountB = BigInt(10_000_000_000); // 10 token B
      const minLpTokens = BigInt(3_000_000_000); // 3 LP tokens

      const instruction = createAddLiquidityInstruction(
        programId,
        poolAddress,
        poolAuthority,
        poolTokenAccountA,
        poolTokenAccountB,
        lpTokenMint,
        feeAccount,
        tokenAMint,
        tokenBMint,
        dummyUser,
        userTokenA,
        userTokenB,
        userLpToken,
        amountA,
        amountB,
        minLpTokens
      );

      // Verify instruction data
      const data = instruction.data;
      console.log(`  Instruction data length: ${data.length} bytes`);
      console.log(`  Instruction data (hex): ${data.toString('hex')}`);

      // Check discriminator
      const discriminator = data.readUInt8(0);
      const discriminatorPassed = discriminator === 2;
      console.log(`  ${discriminatorPassed ? '✅' : '❌'} Discriminator: ${discriminator} (expected 2)`);

      // Check data length
      const lengthPassed = data.length === 25;
      console.log(`  ${lengthPassed ? '✅' : '❌'} Data length: ${data.length} bytes (expected 25)`);

      // Check amounts
      const poolTokenAmount = data.readBigUInt64LE(1);
      const maxTokenA = data.readBigUInt64LE(9);
      const maxTokenB = data.readBigUInt64LE(17);

      const amountsPassed = 
        poolTokenAmount === minLpTokens &&
        maxTokenA === amountA &&
        maxTokenB === amountB;

      console.log(`  ${amountsPassed ? '✅' : '❌'} Amounts:`);
      console.log(`    Pool token amount: ${poolTokenAmount} (expected ${minLpTokens})`);
      console.log(`    Max token A: ${maxTokenA} (expected ${amountA})`);
      console.log(`    Max token B: ${maxTokenB} (expected ${amountB})`);

      // Check account count
      const accountCountPassed = instruction.keys.length === 14;
      console.log(`  ${accountCountPassed ? '✅' : '❌'} Account count: ${instruction.keys.length} (expected 14)`);

      // Verify account flags
      const flagTests = [
        { index: 0, name: 'swap_account', isSigner: false, isWritable: false },
        { index: 1, name: 'swap_authority', isSigner: false, isWritable: false },
        { index: 2, name: 'user_transfer_authority', isSigner: true, isWritable: false },
        { index: 3, name: 'user_token_a_account', isSigner: false, isWritable: true },
        { index: 4, name: 'user_token_b_account', isSigner: false, isWritable: true },
        { index: 5, name: 'pool_token_a_account', isSigner: false, isWritable: true },
        { index: 6, name: 'pool_token_b_account', isSigner: false, isWritable: true },
        { index: 7, name: 'pool_mint', isSigner: false, isWritable: true },
        { index: 8, name: 'user_lp_token_account', isSigner: false, isWritable: true },
      ];

      let flagsPassed = true;
      console.log(`  Account flags:`);
      for (const test of flagTests) {
        const account = instruction.keys[test.index];
        const passed = 
          account.isSigner === test.isSigner &&
          account.isWritable === test.isWritable;
        flagsPassed = flagsPassed && passed;
        console.log(`    ${passed ? '✅' : '❌'} ${test.name}: signer=${account.isSigner}, writable=${account.isWritable}`);
      }

      const allPassed = discriminatorPassed && lengthPassed && amountsPassed && accountCountPassed && flagsPassed;

      this.results.push({
        test: 'Add Liquidity Instruction Data',
        passed: allPassed,
        details: `Discriminator: ${discriminator}, Length: ${data.length}, Accounts: ${instruction.keys.length}`,
      });

      if (allPassed) {
        console.log('\n✅ Add liquidity instruction data is correctly formatted!');
      } else {
        console.log('\n❌ Add liquidity instruction data has issues!');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      this.results.push({
        test: 'Add Liquidity Instruction Data',
        passed: false,
        details: 'Failed to create instruction',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 3: Verify instruction data format for remove liquidity
   */
  async testRemoveLiquidityInstructionData(): Promise<void> {
    console.log('\n📋 Test 3: Verify Remove Liquidity Instruction Data Format');
    console.log('='.repeat(60));

    try {
      const poolConfig = dexConfig.pools[TEST_POOL_INDEX];
      const programId = new PublicKey(dexConfig.programId);
      const poolAddress = new PublicKey(poolConfig.poolAddress);
      const poolAuthority = new PublicKey(poolConfig.authority);
      const poolTokenAccountA = new PublicKey(poolConfig.tokenAccountA);
      const poolTokenAccountB = new PublicKey(poolConfig.tokenAccountB);
      const lpTokenMint = new PublicKey(poolConfig.poolTokenMint);
      const feeAccount = new PublicKey(poolConfig.feeAccount);
      const tokenAMint = new PublicKey(poolConfig.tokenA);
      const tokenBMint = new PublicKey(poolConfig.tokenB);

      // Create dummy user accounts for testing
      const dummyUser = Keypair.generate().publicKey;
      const userTokenA = await getAssociatedTokenAddress(tokenAMint, dummyUser);
      const userTokenB = await getAssociatedTokenAddress(tokenBMint, dummyUser);
      const userLpToken = await getAssociatedTokenAddress(lpTokenMint, dummyUser);

      // Test amounts
      const lpTokenAmount = BigInt(3_000_000_000); // 3 LP tokens
      const minTokenA = BigInt(950_000_000); // 0.95 token A
      const minTokenB = BigInt(9_500_000_000); // 9.5 token B

      const instruction = createRemoveLiquidityInstruction(
        programId,
        poolAddress,
        poolAuthority,
        poolTokenAccountA,
        poolTokenAccountB,
        lpTokenMint,
        feeAccount,
        tokenAMint,
        tokenBMint,
        dummyUser,
        userTokenA,
        userTokenB,
        userLpToken,
        lpTokenAmount,
        minTokenA,
        minTokenB
      );

      // Verify instruction data
      const data = instruction.data;
      console.log(`  Instruction data length: ${data.length} bytes`);
      console.log(`  Instruction data (hex): ${data.toString('hex')}`);

      // Check discriminator
      const discriminator = data.readUInt8(0);
      const discriminatorPassed = discriminator === 3;
      console.log(`  ${discriminatorPassed ? '✅' : '❌'} Discriminator: ${discriminator} (expected 3)`);

      // Check data length
      const lengthPassed = data.length === 25;
      console.log(`  ${lengthPassed ? '✅' : '❌'} Data length: ${data.length} bytes (expected 25)`);

      // Check amounts
      const poolTokenAmount = data.readBigUInt64LE(1);
      const minA = data.readBigUInt64LE(9);
      const minB = data.readBigUInt64LE(17);

      const amountsPassed = 
        poolTokenAmount === lpTokenAmount &&
        minA === minTokenA &&
        minB === minTokenB;

      console.log(`  ${amountsPassed ? '✅' : '❌'} Amounts:`);
      console.log(`    Pool token amount: ${poolTokenAmount} (expected ${lpTokenAmount})`);
      console.log(`    Min token A: ${minA} (expected ${minTokenA})`);
      console.log(`    Min token B: ${minB} (expected ${minTokenB})`);

      // Check account count
      const accountCountPassed = instruction.keys.length === 15;
      console.log(`  ${accountCountPassed ? '✅' : '❌'} Account count: ${instruction.keys.length} (expected 15)`);

      // Verify account flags
      const flagTests = [
        { index: 0, name: 'swap_account', isSigner: false, isWritable: false },
        { index: 1, name: 'swap_authority', isSigner: false, isWritable: false },
        { index: 2, name: 'user_transfer_authority', isSigner: true, isWritable: false },
        { index: 3, name: 'pool_mint', isSigner: false, isWritable: true },
        { index: 4, name: 'user_lp_token_account', isSigner: false, isWritable: true },
        { index: 5, name: 'pool_token_a_account', isSigner: false, isWritable: true },
        { index: 6, name: 'pool_token_b_account', isSigner: false, isWritable: true },
        { index: 7, name: 'user_token_a_account', isSigner: false, isWritable: true },
        { index: 8, name: 'user_token_b_account', isSigner: false, isWritable: true },
        { index: 9, name: 'fee_account', isSigner: false, isWritable: true },
      ];

      let flagsPassed = true;
      console.log(`  Account flags:`);
      for (const test of flagTests) {
        const account = instruction.keys[test.index];
        const passed = 
          account.isSigner === test.isSigner &&
          account.isWritable === test.isWritable;
        flagsPassed = flagsPassed && passed;
        console.log(`    ${passed ? '✅' : '❌'} ${test.name}: signer=${account.isSigner}, writable=${account.isWritable}`);
      }

      const allPassed = discriminatorPassed && lengthPassed && amountsPassed && accountCountPassed && flagsPassed;

      this.results.push({
        test: 'Remove Liquidity Instruction Data',
        passed: allPassed,
        details: `Discriminator: ${discriminator}, Length: ${data.length}, Accounts: ${instruction.keys.length}`,
      });

      if (allPassed) {
        console.log('\n✅ Remove liquidity instruction data is correctly formatted!');
      } else {
        console.log('\n❌ Remove liquidity instruction data has issues!');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      this.results.push({
        test: 'Remove Liquidity Instruction Data',
        passed: false,
        details: 'Failed to create instruction',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 4: Verify pool configuration
   */
  async testPoolConfiguration(): Promise<void> {
    console.log('\n📋 Test 4: Verify Pool Configuration');
    console.log('='.repeat(60));

    try {
      const poolConfig = dexConfig.pools[TEST_POOL_INDEX];
      
      console.log(`  Pool: ${poolConfig.tokenASymbol}/${poolConfig.tokenBSymbol} Shard ${poolConfig.shardNumber}`);
      console.log(`  Program ID: ${dexConfig.programId}`);
      console.log(`  Pool Address: ${poolConfig.poolAddress}`);
      console.log(`  Authority: ${poolConfig.authority}`);
      console.log(`  Token A: ${poolConfig.tokenA}`);
      console.log(`  Token B: ${poolConfig.tokenB}`);
      console.log(`  LP Token Mint: ${poolConfig.poolTokenMint}`);
      console.log(`  Fee Account: ${poolConfig.feeAccount}`);

      // Verify all addresses are valid public keys
      const addresses = [
        { name: 'programId', value: dexConfig.programId },
        { name: 'poolAddress', value: poolConfig.poolAddress },
        { name: 'authority', value: poolConfig.authority },
        { name: 'tokenA', value: poolConfig.tokenA },
        { name: 'tokenB', value: poolConfig.tokenB },
        { name: 'poolTokenMint', value: poolConfig.poolTokenMint },
        { name: 'feeAccount', value: poolConfig.feeAccount },
        { name: 'tokenAccountA', value: poolConfig.tokenAccountA },
        { name: 'tokenAccountB', value: poolConfig.tokenAccountB },
      ];

      let allValid = true;
      for (const addr of addresses) {
        try {
          new PublicKey(addr.value);
          console.log(`  ✅ ${addr.name}: Valid`);
        } catch {
          console.log(`  ❌ ${addr.name}: Invalid`);
          allValid = false;
        }
      }

      this.results.push({
        test: 'Pool Configuration',
        passed: allValid,
        details: `Pool: ${poolConfig.tokenASymbol}/${poolConfig.tokenBSymbol} Shard ${poolConfig.shardNumber}`,
      });

      if (allValid) {
        console.log('\n✅ Pool configuration is valid!');
      } else {
        console.log('\n❌ Pool configuration has invalid addresses!');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      this.results.push({
        test: 'Pool Configuration',
        passed: false,
        details: 'Failed to verify pool configuration',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Print summary of all tests
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.details}`);
          if (r.error) {
            console.log(`    Error: ${r.error}`);
          }
        });
    }

    console.log('\n' + '='.repeat(60));
    
    if (failed === 0) {
      console.log('✅ ALL TESTS PASSED! The liquidity fix is correctly implemented.');
      console.log('\n📝 Next Steps:');
      console.log('  1. Test add liquidity on devnet with a real wallet');
      console.log('  2. Test remove liquidity on devnet with a real wallet');
      console.log('  3. Verify LP tokens are minted/burned correctly');
      console.log('  4. Verify token balances change as expected');
    } else {
      console.log('❌ SOME TESTS FAILED! Please review the implementation.');
    }
    console.log('='.repeat(60));
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Liquidity Smart Contract Fix Tests');
    console.log('='.repeat(60));
    console.log(`RPC Endpoint: ${DEVNET_RPC}`);
    const testPool = dexConfig.pools[TEST_POOL_INDEX];
    console.log(`Test Pool: ${testPool.tokenASymbol}/${testPool.tokenBSymbol} Shard ${testPool.shardNumber}`);

    await this.testDiscriminators();
    await this.testAddLiquidityInstructionData();
    await this.testRemoveLiquidityInstructionData();
    await this.testPoolConfiguration();

    this.printSummary();
  }
}

// Run tests
const tester = new LiquidityTester();
tester.runAllTests().catch(console.error);
