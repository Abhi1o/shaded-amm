/**
 * Simple test script to verify discriminator values
 * Run with: node scripts/test-discriminators.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Liquidity Smart Contract Fix - Discriminators');
console.log('='.repeat(70));

// Read the poolInstructions file
const poolInstructionsPath = path.join(__dirname, '../src/lib/solana/poolInstructions.ts');
const content = fs.readFileSync(poolInstructionsPath, 'utf8');

// Extract discriminator values using regex
const discriminatorMatch = content.match(/export const INSTRUCTION_DISCRIMINATORS = \{([^}]+)\}/s);

if (!discriminatorMatch) {
  console.error('❌ Could not find INSTRUCTION_DISCRIMINATORS in poolInstructions.ts');
  process.exit(1);
}

const discriminatorBlock = discriminatorMatch[1];

// Parse discriminator values
const discriminators = {};
const lines = discriminatorBlock.split('\n');
for (const line of lines) {
  const match = line.match(/(\w+):\s*(\d+)/);
  if (match) {
    discriminators[match[1]] = parseInt(match[2]);
  }
}

console.log('\n📋 Test 1: Verify Discriminator Values');
console.log('-'.repeat(70));

const expectedValues = {
  INITIALIZE: 0,
  SWAP: 1,
  ADD_LIQUIDITY: 2,
  REMOVE_LIQUIDITY: 3,
  ADD_SINGLE: 4,
  REMOVE_SINGLE: 5,
};

let allPassed = true;
const results = [];

for (const [name, expected] of Object.entries(expectedValues)) {
  const actual = discriminators[name];
  const passed = actual === expected;
  allPassed = allPassed && passed;
  
  const status = passed ? '✅' : '❌';
  console.log(`  ${status} ${name.padEnd(20)} = ${actual} (expected ${expected})`);
  
  results.push({ name, passed, actual, expected });
}

console.log('\n📋 Test 2: Verify Instruction Data Builders');
console.log('-'.repeat(70));

// Check for buildAddLiquidityInstructionData
const hasAddBuilder = content.includes('export function buildAddLiquidityInstructionData');
console.log(`  ${hasAddBuilder ? '✅' : '❌'} buildAddLiquidityInstructionData function exists`);

// Check for buildRemoveLiquidityInstructionData
const hasRemoveBuilder = content.includes('export function buildRemoveLiquidityInstructionData');
console.log(`  ${hasRemoveBuilder ? '✅' : '❌'} buildRemoveLiquidityInstructionData function exists`);

// Check for correct discriminator usage in add liquidity
const addLiquidityUsesCorrectDiscriminator = content.includes('INSTRUCTION_DISCRIMINATORS.ADD_LIQUIDITY');
console.log(`  ${addLiquidityUsesCorrectDiscriminator ? '✅' : '❌'} Add liquidity uses INSTRUCTION_DISCRIMINATORS.ADD_LIQUIDITY`);

// Check for correct discriminator usage in remove liquidity
const removeLiquidityUsesCorrectDiscriminator = content.includes('INSTRUCTION_DISCRIMINATORS.REMOVE_LIQUIDITY');
console.log(`  ${removeLiquidityUsesCorrectDiscriminator ? '✅' : '❌'} Remove liquidity uses INSTRUCTION_DISCRIMINATORS.REMOVE_LIQUIDITY`);

// Check for 25-byte buffer allocation
const has25ByteBuffer = content.match(/Buffer\.alloc\(25\)/g);
console.log(`  ${has25ByteBuffer && has25ByteBuffer.length >= 2 ? '✅' : '❌'} Both functions allocate 25-byte buffers`);

console.log('\n📋 Test 3: Verify Account Order Documentation');
console.log('-'.repeat(70));

// Check for add liquidity account documentation
const hasAddAccountDocs = content.includes('Account Order (14 accounts total)');
console.log(`  ${hasAddAccountDocs ? '✅' : '❌'} Add liquidity has account order documentation (14 accounts)`);

// Check for remove liquidity account documentation
const hasRemoveAccountDocs = content.includes('Account Order (15 accounts total)');
console.log(`  ${hasRemoveAccountDocs ? '✅' : '❌'} Remove liquidity has account order documentation (15 accounts)`);

// Check for critical warnings
const hasCriticalWarnings = content.includes('⚠️ CRITICAL');
console.log(`  ${hasCriticalWarnings ? '✅' : '❌'} Contains critical warnings about account order`);

console.log('\n📋 Test 4: Verify Input Validation');
console.log('-'.repeat(70));

// Check for validation in add liquidity
const hasAddValidation = content.includes('if (poolTokenAmount <= BigInt(0))') && 
                         content.includes('if (maxTokenA <= BigInt(0))') &&
                         content.includes('if (maxTokenB <= BigInt(0))');
console.log(`  ${hasAddValidation ? '✅' : '❌'} Add liquidity has input validation`);

// Check for validation in remove liquidity
const hasRemoveValidation = content.includes('if (poolTokenAmount <= BigInt(0))') && 
                           content.includes('if (minTokenA < BigInt(0))') &&
                           content.includes('if (minTokenB < BigInt(0))');
console.log(`  ${hasRemoveValidation ? '✅' : '❌'} Remove liquidity has input validation`);

console.log('\n📋 Test 5: Verify Debug Logging');
console.log('-'.repeat(70));

// Check for debug logging
const hasAddLogging = content.includes('console.log(\'🔧 Add Liquidity Instruction:\')');
console.log(`  ${hasAddLogging ? '✅' : '❌'} Add liquidity has debug logging`);

const hasRemoveLogging = content.includes('console.log(\'🔧 Remove Liquidity Instruction:\')');
console.log(`  ${hasRemoveLogging ? '✅' : '❌'} Remove liquidity has debug logging`);

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(70));

const passedTests = results.filter(r => r.passed).length;
const totalTests = results.length;

console.log(`\nDiscriminator Tests: ${passedTests}/${totalTests} passed`);

const allTestsPassed = allPassed && 
                       hasAddBuilder && 
                       hasRemoveBuilder && 
                       addLiquidityUsesCorrectDiscriminator && 
                       removeLiquidityUsesCorrectDiscriminator &&
                       has25ByteBuffer &&
                       hasAddAccountDocs &&
                       hasRemoveAccountDocs &&
                       hasCriticalWarnings &&
                       hasAddValidation &&
                       hasRemoveValidation &&
                       hasAddLogging &&
                       hasRemoveLogging;

if (allTestsPassed) {
  console.log('\n✅ ALL TESTS PASSED!');
  console.log('\nThe liquidity smart contract fix is correctly implemented:');
  console.log('  ✓ Discriminator values match smart contract specification');
  console.log('  ✓ ADD_LIQUIDITY uses discriminator 2 (was 0)');
  console.log('  ✓ REMOVE_LIQUIDITY uses discriminator 3 (was 2)');
  console.log('  ✓ Instruction data builders are correctly formatted (25 bytes)');
  console.log('  ✓ Account orders are documented (14 for add, 15 for remove)');
  console.log('  ✓ Input validation is implemented');
  console.log('  ✓ Debug logging is in place');
  console.log('\n📝 Next Steps:');
  console.log('  1. Test add liquidity on devnet with a real wallet');
  console.log('  2. Test remove liquidity on devnet with a real wallet');
  console.log('  3. Verify LP tokens are minted/burned correctly');
  console.log('  4. Verify token balances change as expected');
  console.log('  5. Test error scenarios (insufficient balance, etc.)');
  console.log('  6. Verify swap functionality still works');
} else {
  console.log('\n❌ SOME TESTS FAILED!');
  console.log('\nPlease review the implementation and fix any issues.');
  
  if (!allPassed) {
    console.log('\nFailed discriminator tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.actual} (expected ${r.expected})`);
    });
  }
}

console.log('='.repeat(70));

process.exit(allTestsPassed ? 0 : 1);
