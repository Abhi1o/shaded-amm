require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.MULTI_CHAIN_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Load deployment data
const riseChainData = require('../../deployment-data/risechain-multi-shard-1764273559148.json');
const monadData = require('../../deployment-data/monad-multi-shard-1764330063991.json');

// Contract ABIs
const SAMM_POOL_ABI = [
  "function getReserves() view returns (uint256 reserveA, uint256 reserveB)",
  "function calculateSwapSAMM(uint256 amountOut, address tokenIn, address tokenOut) view returns (tuple(uint256 amountIn, uint256 amountOut, uint256 tradeFee, uint256 ownerFee))",
  "function getPoolState() view returns (tuple(address tokenA, address tokenB, uint256 reserveA, uint256 reserveB, uint256 totalSupply, uint256 tradeFeeNumerator, uint256 tradeFeeDenominator, uint256 ownerFeeNumerator, uint256 ownerFeeDenominator))",
  "function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) pure returns (uint256 amountB)",
  "function getSAMMParams() view returns (int256 beta1, uint256 rmin, uint256 rmax, uint256 c)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

// Chain configurations with deployment data
const CHAINS = {
  risechain: {
    chainId: 11155931,
    name: "RiseChain Testnet",
    rpcUrl: "https://testnet.riselabs.xyz",
    nativeToken: { symbol: "ETH", decimals: 18 },
    deploymentData: riseChainData
  },
  monad: {
    chainId: 10143,
    name: "Monad Testnet",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    nativeToken: { symbol: "MON", decimals: 18 },
    deploymentData: monadData
  }
};

// Initialize providers and contracts for each chain
const providers = {};
const chainStatus = {};
const chainContracts = {};

async function initializeChains() {
  console.log('🔗 Initializing multi-chain providers and contracts...');
  
  for (const [chainName, config] of Object.entries(CHAINS)) {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Test connection
      const network = await provider.getNetwork();
      providers[chainName] = provider;
      
      // Initialize contracts for this chain
      if (config.deploymentData) {
        await initializeChainContracts(chainName, config.deploymentData, provider);
      }
      
      chainStatus[chainName] = {
        status: 'connected',
        chainId: Number(network.chainId),
        blockNumber: await provider.getBlockNumber(),
        lastChecked: new Date().toISOString(),
        contractsInitialized: !!config.deploymentData
      };
      
      console.log(`✅ ${config.name} connected (Chain ID: ${network.chainId})`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.name}:`, error.message);
      chainStatus[chainName] = {
        status: 'failed',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
}

async function initializeChainContracts(chainName, deploymentData, provider) {
  try {
    console.log(`🔧 Initializing contracts for ${chainName}...`);
    
    chainContracts[chainName] = {
      shards: {},
      tokens: {},
      factory: deploymentData.contracts.factory
    };

    // Group shards by pair
    const shardsByPair = {};
    deploymentData.contracts.shards.forEach(shard => {
      if (!shardsByPair[shard.pairName]) {
        shardsByPair[shard.pairName] = [];
      }
      shardsByPair[shard.pairName].push(shard);
    });

    // Initialize shard contracts
    for (const [pairName, shards] of Object.entries(shardsByPair)) {
      chainContracts[chainName].shards[pairName] = [];
      for (const shard of shards) {
        const contract = new ethers.Contract(shard.address, SAMM_POOL_ABI, provider);
        chainContracts[chainName].shards[pairName].push({
          ...shard,
          contract
        });
        console.log(`  ✅ ${shard.name}: ${shard.address}`);
      }
    }

    // Initialize token contracts
    for (const token of deploymentData.contracts.tokens) {
      chainContracts[chainName].tokens[token.symbol] = {
        ...token,
        contract: new ethers.Contract(token.address, ERC20_ABI, provider)
      };
      console.log(`  ✅ ${token.symbol} token: ${token.address}`);
    }

    console.log(`✅ All contracts initialized for ${chainName}`);
  } catch (error) {
    console.error(`❌ Error initializing contracts for ${chainName}:`, error);
  }
}

// Helper functions
function getTokenBySymbol(chainName, symbol) {
  return chainContracts[chainName]?.tokens[symbol];
}

function getTokenByAddress(chainName, address) {
  const tokens = chainContracts[chainName]?.tokens || {};
  return Object.values(tokens).find(t => 
    t.address.toLowerCase() === address.toLowerCase()
  );
}

function getPairName(chainName, tokenA, tokenB) {
  const tokenAData = getTokenByAddress(chainName, tokenA);
  const tokenBData = getTokenByAddress(chainName, tokenB);
  
  if (!tokenAData || !tokenBData) return null;
  
  const pairs = [
    `${tokenAData.symbol}/${tokenBData.symbol}`,
    `${tokenBData.symbol}/${tokenAData.symbol}`
  ];
  
  const shards = chainContracts[chainName]?.shards || {};
  for (const pair of pairs) {
    if (shards[pair]) return pair;
  }
  return null;
}

function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
  try {
    const spotPriceBefore = Number(reserveOut) / Number(reserveIn);
    const effectivePrice = Number(amountOut) / Number(amountIn);
    const priceImpact = ((spotPriceBefore - effectivePrice) / spotPriceBefore) * 100;
    return priceImpact.toFixed(4);
  } catch (error) {
    return '0';
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  const connectedChains = Object.values(chainStatus).filter(s => s.status === 'connected').length;
  const totalChains = Object.keys(CHAINS).length;
  
  res.json({
    status: 'ok',
    service: 'multi-chain-backend',
    chains: {
      connected: connectedChains,
      total: totalChains,
      percentage: Math.round((connectedChains / totalChains) * 100)
    },
    timestamp: new Date().toISOString()
  });
});

// Get all supported chains
app.get('/api/chains', (req, res) => {
  const chainsInfo = Object.entries(CHAINS).map(([name, config]) => ({
    name: name,
    chainId: config.chainId,
    displayName: config.name,
    nativeToken: config.nativeToken,
    status: chainStatus[name] || { status: 'unknown' },
    deployed: !!config.deploymentData,
    totalShards: config.deploymentData ? config.deploymentData.contracts.shards.length : 0,
    endpoints: {
      info: `/api/${name}/info`,
      shards: `/api/${name}/shards`,
      pools: `/api/${name}/pools`,
      bestShard: `/api/${name}/swap/best-shard`,
      crossPool: `/api/${name}/swap/cross-pool`,
      shard: `/api/${name}/shard/:address`
    }
  }));

  res.json({
    totalChains: chainsInfo.length,
    chains: chainsInfo,
    deployedChains: chainsInfo.filter(c => c.deployed).length,
    timestamp: new Date().toISOString()
  });
});

// Chain-specific info endpoint
app.get('/api/:chainName/info', async (req, res) => {
  try {
    const { chainName } = req.params;
    const config = CHAINS[chainName];
    const provider = providers[chainName];
    
    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }
    
    if (!provider) {
      return res.status(503).json({ error: `Chain ${chainName} not connected` });
    }

    const [network, blockNumber, gasPrice] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getFeeData()
    ]);

    res.json({
      chain: chainName,
      config: config,
      network: {
        chainId: Number(network.chainId),
        name: network.name
      },
      status: {
        connected: true,
        blockNumber: blockNumber,
        gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : 'unknown'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error getting info for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to get chain info' });
  }
});

// Get all shards for a chain
app.get('/api/:chainName/shards', async (req, res) => {
  try {
    const { chainName } = req.params;
    const config = CHAINS[chainName];
    const contracts = chainContracts[chainName];
    
    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }
    
    if (!contracts) {
      return res.status(503).json({ error: `No contracts deployed on ${chainName}` });
    }

    const shardsInfo = {};
    
    for (const [pairName, shards] of Object.entries(contracts.shards)) {
      shardsInfo[pairName] = [];
      
      for (const shard of shards) {
        try {
          const [poolState, sammParams] = await Promise.all([
            shard.contract.getPoolState(),
            shard.contract.getSAMMParams()
          ]);
          
          shardsInfo[pairName].push({
            name: shard.name,
            address: shard.address,
            liquidity: shard.liquidity,
            reserves: {
              tokenA: poolState.reserveA.toString(),
              tokenB: poolState.reserveB.toString()
            },
            sammParams: {
              beta1: sammParams[0].toString(),
              rmin: sammParams[1].toString(),
              rmax: sammParams[2].toString(),
              c: sammParams[3].toString()
            },
            fees: {
              tradeFeeNumerator: poolState.tradeFeeNumerator.toString(),
              tradeFeeDenominator: poolState.tradeFeeDenominator.toString(),
              ownerFeeNumerator: poolState.ownerFeeNumerator.toString(),
              ownerFeeDenominator: poolState.ownerFeeDenominator.toString()
            }
          });
        } catch (error) {
          console.error(`Error fetching info for ${shard.name}:`, error);
        }
      }
    }
    
    res.json({
      chain: chainName,
      chainId: config.chainId,
      shards: shardsInfo,
      totalShards: Object.values(shardsInfo).flat().length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching shards for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to fetch shards information' });
  }
});

// Chain-specific pools endpoint (legacy compatibility)
app.get('/api/:chainName/pools', async (req, res) => {
  try {
    const { chainName } = req.params;
    const config = CHAINS[chainName];
    const contracts = chainContracts[chainName];
    
    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }
    
    if (!contracts) {
      return res.json({
        chain: chainName,
        pools: [],
        totalPools: 0,
        message: `No pools deployed on ${config.name} yet`,
        timestamp: new Date().toISOString()
      });
    }

    // Convert shards to pools format
    const pools = [];
    for (const [pairName, shards] of Object.entries(contracts.shards)) {
      for (const shard of shards) {
        pools.push({
          name: shard.name,
          address: shard.address,
          liquidity: shard.liquidity,
          pairName: pairName
        });
      }
    }

    res.json({
      chain: chainName,
      chainId: config.chainId,
      pools: pools,
      totalPools: pools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching pools for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to fetch pools information' });
  }
});

// Find best shard for swap on specific chain
app.post('/api/:chainName/swap/best-shard', async (req, res) => {
  try {
    const { chainName } = req.params;
    const { amountOut, tokenIn, tokenOut } = req.body;
    const config = CHAINS[chainName];
    const contracts = chainContracts[chainName];

    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }

    if (!contracts) {
      return res.status(503).json({ error: `No contracts deployed on ${chainName}` });
    }

    if (!amountOut || !tokenIn || !tokenOut) {
      return res.status(400).json({ 
        error: 'Missing required parameters: amountOut, tokenIn, tokenOut' 
      });
    }

    const pairName = getPairName(chainName, tokenIn, tokenOut);
    if (!pairName || !contracts.shards[pairName]) {
      return res.status(400).json({ 
        error: `No shards available for this token pair on ${chainName}` 
      });
    }

    const shards = contracts.shards[pairName];
    const swapResults = [];

    // Calculate swap on all shards
    for (const shard of shards) {
      try {
        const result = await shard.contract.calculateSwapSAMM(amountOut, tokenIn, tokenOut);
        const poolState = await shard.contract.getPoolState();
        
        swapResults.push({
          shardName: shard.name,
          shardAddress: shard.address,
          liquidity: shard.liquidity,
          amountIn: result.amountIn.toString(),
          amountOut: result.amountOut.toString(),
          tradeFee: result.tradeFee.toString(),
          ownerFee: result.ownerFee.toString(),
          totalCost: result.amountIn.toString(),
          priceImpact: calculatePriceImpact(
            result.amountIn,
            result.amountOut,
            tokenIn.toLowerCase() === poolState.tokenA.toLowerCase() ? poolState.reserveA : poolState.reserveB,
            tokenIn.toLowerCase() === poolState.tokenA.toLowerCase() ? poolState.reserveB : poolState.reserveA
          )
        });
      } catch (error) {
        console.error(`Error calculating swap for ${shard.name}:`, error);
      }
    }

    if (swapResults.length === 0) {
      return res.status(500).json({ error: 'No valid swap results found' });
    }

    // Sort by total cost (ascending) - best rate first
    swapResults.sort((a, b) => Number(a.totalCost) - Number(b.totalCost));
    
    const bestShard = swapResults[0];
    
    res.json({
      chain: chainName,
      chainId: config.chainId,
      bestShard,
      allShards: swapResults,
      cSmallerBetterDemonstrated: swapResults.length > 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error finding best shard for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to find best shard for swap' });
  }
});

// Cross-pool routing on specific chain
app.post('/api/:chainName/swap/cross-pool', async (req, res) => {
  try {
    const { chainName } = req.params;
    const { amountIn, tokenIn, tokenOut } = req.body;
    const config = CHAINS[chainName];
    const contracts = chainContracts[chainName];

    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }

    if (!contracts) {
      return res.status(503).json({ error: `No contracts deployed on ${chainName}` });
    }

    if (!amountIn || !tokenIn || !tokenOut) {
      return res.status(400).json({ 
        error: 'Missing required parameters: amountIn, tokenIn, tokenOut' 
      });
    }

    const tokenInData = getTokenByAddress(chainName, tokenIn);
    const tokenOutData = getTokenByAddress(chainName, tokenOut);
    
    if (!tokenInData || !tokenOutData) {
      return res.status(400).json({ error: `Invalid token addresses for ${chainName}` });
    }

    // Direct swap if pair exists
    const directPair = getPairName(chainName, tokenIn, tokenOut);
    if (directPair && contracts.shards[directPair]) {
      const shards = contracts.shards[directPair];
      const bestShard = shards[0]; // Use first shard for simplicity
      
      const result = await bestShard.contract.calculateSwapSAMM(amountIn, tokenIn, tokenOut);
      
      return res.json({
        chain: chainName,
        chainId: config.chainId,
        route: 'direct',
        path: [tokenInData.symbol, tokenOutData.symbol],
        shards: [bestShard.name],
        amountIn: amountIn.toString(),
        amountOut: result.amountOut.toString(),
        totalFee: result.tradeFee.toString(),
        steps: [{
          from: tokenInData.symbol,
          to: tokenOutData.symbol,
          shard: bestShard.name,
          amountIn: amountIn.toString(),
          amountOut: result.amountOut.toString()
        }],
        timestamp: new Date().toISOString()
      });
    }

    // Multi-hop routing through USDC
    const usdcToken = getTokenBySymbol(chainName, 'USDC');
    if (!usdcToken) {
      return res.status(400).json({ error: `USDC not available on ${chainName}` });
    }

    let route = [];
    let totalAmountOut = amountIn;
    let steps = [];

    if (tokenInData.symbol !== 'USDC') {
      // First hop: tokenIn -> USDC
      const firstPair = getPairName(chainName, tokenIn, usdcToken.address);
      if (!firstPair || !contracts.shards[firstPair]) {
        return res.status(400).json({ 
          error: `No route available from ${tokenInData.symbol} to USDC on ${chainName}` 
        });
      }
      
      const firstShard = contracts.shards[firstPair][0];
      const firstResult = await firstShard.contract.calculateSwapSAMM(totalAmountOut, tokenIn, usdcToken.address);
      
      steps.push({
        from: tokenInData.symbol,
        to: 'USDC',
        shard: firstShard.name,
        amountIn: totalAmountOut.toString(),
        amountOut: firstResult.amountOut.toString()
      });
      
      totalAmountOut = firstResult.amountOut;
      route.push(tokenInData.symbol, 'USDC');
    } else {
      route.push('USDC');
    }

    if (tokenOutData.symbol !== 'USDC') {
      // Second hop: USDC -> tokenOut
      const secondPair = getPairName(chainName, usdcToken.address, tokenOut);
      if (!secondPair || !contracts.shards[secondPair]) {
        return res.status(400).json({ 
          error: `No route available from USDC to ${tokenOutData.symbol} on ${chainName}` 
        });
      }
      
      const secondShard = contracts.shards[secondPair][0];
      const secondResult = await secondShard.contract.calculateSwapSAMM(totalAmountOut, usdcToken.address, tokenOut);
      
      steps.push({
        from: 'USDC',
        to: tokenOutData.symbol,
        shard: secondShard.name,
        amountIn: totalAmountOut.toString(),
        amountOut: secondResult.amountOut.toString()
      });
      
      totalAmountOut = secondResult.amountOut;
      route.push(tokenOutData.symbol);
    }

    const totalFee = steps.reduce((sum, step) => sum + Number(step.tradeFee || 0), 0);

    res.json({
      chain: chainName,
      chainId: config.chainId,
      route: 'multi-hop',
      path: route,
      shards: steps.map(s => s.shard),
      amountIn: amountIn.toString(),
      amountOut: totalAmountOut.toString(),
      totalFee: totalFee.toString(),
      steps,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error calculating cross-pool route for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to calculate cross-pool route' });
  }
});

// Get specific shard info on chain
app.get('/api/:chainName/shard/:address', async (req, res) => {
  try {
    const { chainName, address } = req.params;
    const config = CHAINS[chainName];
    const contracts = chainContracts[chainName];
    
    if (!config) {
      return res.status(404).json({ error: `Chain ${chainName} not supported` });
    }
    
    if (!contracts) {
      return res.status(503).json({ error: `No contracts deployed on ${chainName}` });
    }
    
    // Find the shard
    let targetShard = null;
    for (const shards of Object.values(contracts.shards)) {
      targetShard = shards.find(s => s.address.toLowerCase() === address.toLowerCase());
      if (targetShard) break;
    }
    
    if (!targetShard) {
      return res.status(404).json({ error: `Shard not found on ${chainName}` });
    }
    
    const [poolState, sammParams] = await Promise.all([
      targetShard.contract.getPoolState(),
      targetShard.contract.getSAMMParams()
    ]);
    
    // Get token info
    const tokenAData = getTokenByAddress(chainName, poolState.tokenA);
    const tokenBData = getTokenByAddress(chainName, poolState.tokenB);
    
    res.json({
      chain: chainName,
      chainId: config.chainId,
      name: targetShard.name,
      address: targetShard.address,
      liquidity: targetShard.liquidity,
      tokens: {
        tokenA: {
          address: poolState.tokenA,
          symbol: tokenAData?.symbol
        },
        tokenB: {
          address: poolState.tokenB,
          symbol: tokenBData?.symbol
        }
      },
      reserves: {
        tokenA: poolState.reserveA.toString(),
        tokenB: poolState.reserveB.toString()
      },
      sammParams: {
        beta1: sammParams[0].toString(),
        rmin: sammParams[1].toString(),
        rmax: sammParams[2].toString(),
        c: sammParams[3].toString()
      },
      fees: {
        tradeFeeNumerator: poolState.tradeFeeNumerator.toString(),
        tradeFeeDenominator: poolState.tradeFeeDenominator.toString(),
        ownerFeeNumerator: poolState.ownerFeeNumerator.toString(),
        ownerFeeDenominator: poolState.ownerFeeDenominator.toString()
      },
      totalSupply: poolState.totalSupply.toString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching shard info for ${req.params.chainName}:`, error);
    res.status(500).json({ error: 'Failed to fetch shard information' });
  }
});

// Cross-chain routing endpoint
app.post('/api/cross-chain/route', (req, res) => {
  const { fromChain, toChain, tokenIn, tokenOut, amountIn } = req.body;
  
  if (!fromChain || !toChain || !tokenIn || !tokenOut || !amountIn) {
    return res.status(400).json({ 
      error: 'Missing required parameters: fromChain, toChain, tokenIn, tokenOut, amountIn' 
    });
  }

  // Placeholder for cross-chain routing logic
  res.json({
    route: {
      fromChain: fromChain,
      toChain: toChain,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      steps: [
        {
          chain: fromChain,
          action: 'swap',
          description: `Swap ${tokenIn} to bridge token on ${fromChain}`
        },
        {
          chain: 'bridge',
          action: 'bridge',
          description: `Bridge tokens from ${fromChain} to ${toChain}`
        },
        {
          chain: toChain,
          action: 'swap',
          description: `Swap bridge token to ${tokenOut} on ${toChain}`
        }
      ]
    },
    status: 'simulation',
    message: 'Cross-chain routing is in development',
    timestamp: new Date().toISOString()
  });
});

// Chain isolation test endpoint
app.get('/api/isolation/test', async (req, res) => {
  try {
    const isolationResults = [];
    
    for (const [chainName, config] of Object.entries(CHAINS)) {
      const provider = providers[chainName];
      
      if (provider) {
        try {
          const blockNumber = await provider.getBlockNumber();
          isolationResults.push({
            chain: chainName,
            status: 'isolated',
            blockNumber: blockNumber,
            independent: true
          });
        } catch (error) {
          isolationResults.push({
            chain: chainName,
            status: 'failed',
            error: error.message,
            independent: false
          });
        }
      } else {
        isolationResults.push({
          chain: chainName,
          status: 'not_connected',
          independent: false
        });
      }
    }

    const successfulIsolations = isolationResults.filter(r => r.independent).length;
    
    res.json({
      isolationTest: {
        passed: successfulIsolations === Object.keys(CHAINS).length,
        successfulChains: successfulIsolations,
        totalChains: Object.keys(CHAINS).length
      },
      results: isolationResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing chain isolation:', error);
    res.status(500).json({ error: 'Failed to test chain isolation' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function start() {
  await initializeChains();
  
  const connectedChains = Object.keys(providers).length;
  const deployedChains = Object.values(CHAINS).filter(c => c.deploymentData).length;
  
  app.listen(PORT, () => {
    console.log(`🚀 SAMM Multi-Chain Backend running on port ${PORT}`);
    console.log(`📊 Chains connected: ${connectedChains}/${Object.keys(CHAINS).length}`);
    console.log(`🔧 Chains with contracts: ${deployedChains}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 Chains info: http://localhost:${PORT}/api/chains`);
    console.log(`\n🌐 Available APIs:`);
    console.log(`   GET  /api/chains - List all chains`);
    console.log(`   GET  /api/{chain}/info - Chain information`);
    console.log(`   GET  /api/{chain}/shards - All shards on chain`);
    console.log(`   POST /api/{chain}/swap/best-shard - Find optimal shard`);
    console.log(`   POST /api/{chain}/swap/cross-pool - Multi-hop routing`);
    console.log(`   GET  /api/{chain}/shard/{address} - Specific shard info`);
    console.log(`\n🔗 Quick Tests:`);
    console.log(`   curl http://localhost:${PORT}/api/chains`);
    console.log(`   curl http://localhost:${PORT}/api/risechain/shards`);
    console.log(`   curl http://localhost:${PORT}/api/monad/shards`);
  });
}

start().catch(console.error);

module.exports = app;