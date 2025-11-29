# DEX Helper Scripts

Utility scripts for managing test tokens and checking balances on Solana Devnet.

## Prerequisites

- Node.js installed
- Solana CLI wallet configured (`~/.config/solana/id.json`)
- SOL in your wallet for transaction fees

## Scripts

### 1. Check Balance

Check the actual on-chain token balances for any wallet:

```bash
node scripts/check-balance.js <WALLET_ADDRESS>
```

**Example:**
```bash
node scripts/check-balance.js HzkaW8LY5uDaDpSvEscSEcrTnngSgwAvsQZzVzCk6TvX
```

**Output:**
- SOL balance
- Token balances for USDC, SOL, USDT, ETH
- Associated Token Account (ATA) addresses
- Status of each token account

### 2. Mint Test Tokens

Mint test tokens to any wallet address:

```bash
node scripts/mint-test-tokens.js <WALLET_ADDRESS> <AMOUNT>
```

**Example:**
```bash
node scripts/mint-test-tokens.js HzkaW8LY5uDaDpSvEscSEcrTnngSgwAvsQZzVzCk6TvX 10000
```

This will mint:
- 10,000 USDC
- 10,000 SOL (wrapped)
- 10,000 USDT  
- 10,000 ETH (wrapped)

**Requirements:**
- Your Solana CLI wallet must have mint authority for the tokens
- You need at least 0.5 SOL for transaction fees

## Common Issues

### "Error loading payer wallet"

You need to create a Solana CLI wallet:

```bash
solana-keygen new
```

### "Insufficient SOL for transaction fees"

Get SOL from the devnet faucet:

```bash
solana airdrop 2
```

Or visit: https://faucet.solana.com/

### "Account does not exist"

The mint script will automatically create the token account.

## Token Mints (Devnet)

- **USDC**: `BJYyjsX1xPbjL661mozEnU2vPf5gznbZAdGRXQh9Gufa`
- **SOL**: `7YGTPNq1Xw1AWt4BfDqd82DAvmyNLEC1RdHzJX9PDB5r`
- **USDT**: `F7CVt32PGjVCJo7N4PS4qUzXVMBQBj3iV4qCVFdHgseu`
- **ETH**: `7K7yLbVHtvcP6zUk6KCCyedDLFuLdNu1eawvsL13LPd`

## Workflow

1. **Check your balance:**
   ```bash
   node scripts/check-balance.js YOUR_WALLET
   ```

2. **Get SOL if needed:**
   ```bash
   solana airdrop 2
   ```

3. **Mint test tokens:**
   ```bash
   node scripts/mint-test-tokens.js YOUR_WALLET 10000
   ```

4. **Verify balance:**
   ```bash
   node scripts/check-balance.js YOUR_WALLET
   ```

5. **Use the DEX UI to swap!**

## Notes

- These scripts work on **Solana Devnet** only
- Tokens are for testing purposes
- Transactions are confirmed before returning
- Each mint operation includes a 1-second delay to avoid rate limiting
