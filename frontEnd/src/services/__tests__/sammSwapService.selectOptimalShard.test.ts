import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SAMMSwapService } from '../sammSwapService';
import { Address, PublicClient } from 'viem';

describe('SAMMSwapService - Optimal Shard Selection', () => {
  let service: SAMMSwapService;
  let mockClient: PublicClient;

  beforeEach(() => {
    service = new SAMMSwapService();
    mockClient = {
      readContract: vi.fn(),
    } as any;
  });

  describe('selectOptimalShard', () => {
    it('should select the shard with the lowest input requirement', async () => {
      // Mock shards with different reserves
      const shards = [
        {
          address: '0x1111111111111111111111111111111111111111' as Address,
          shardNumber: 1,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 1000000000000n, // 1M USDC
            reserve1: 1000000000000n, // 1M USDT
          },
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Address,
          shardNumber: 2,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 5000000000000n, // 5M USDC
            reserve1: 5000000000000n, // 5M USDT
          },
        },
        {
          address: '0x3333333333333333333333333333333333333333' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 10000000000000n, // 10M USDC
            reserve1: 10000000000000n, // 10M USDT
          },
        },
      ];

      // Mock calculateSwapSAMM responses - larger pools should have lower fees
      (mockClient.readContract as any).mockImplementation(({ address }: any) => {
        if (address === shards[0].address) {
          // Shard 1: Smallest pool, highest input required
          return {
            amountIn: 100150000n, // 100.15 USDC
            amountOut: 100000000n, // 100 USDT
            tradeFee: 120000n,
            ownerFee: 30000n,
          };
        } else if (address === shards[1].address) {
          // Shard 2: Medium pool, medium input required
          return {
            amountIn: 100100000n, // 100.10 USDC
            amountOut: 100000000n, // 100 USDT
            tradeFee: 80000n,
            ownerFee: 20000n,
          };
        } else {
          // Shard 3: Largest pool, lowest input required (OPTIMAL)
          return {
            amountIn: 100080000n, // 100.08 USDC
            amountOut: 100000000n, // 100 USDT
            tradeFee: 60000n,
            ownerFee: 20000n,
          };
        }
      });

      const result = await service.selectOptimalShard(
        mockClient,
        shards,
        100000000n, // Want 100 USDT
        '0xUSDC' as Address,
        '0xUSDT' as Address
      );

      // Should select shard 3 (lowest input)
      expect(result.address).toBe(shards[2].address);
      expect(result.shardNumber).toBe(3);
      expect(result.isOptimal).toBe(true);
      expect(result.reason).toBe('Lowest input required');
      expect(result.estimatedInput).toBe(100080000n);
    });

    it('should exclude shards with insufficient liquidity', async () => {
      const shards = [
        {
          address: '0x1111111111111111111111111111111111111111' as Address,
          shardNumber: 1,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 1000000000n, // 1K USDC
            reserve1: 50000000n,   // 50 USDT - INSUFFICIENT
          },
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Address,
          shardNumber: 2,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 5000000000000n, // 5M USDC
            reserve1: 5000000000000n, // 5M USDT - SUFFICIENT
          },
        },
      ];

      (mockClient.readContract as any).mockImplementation(({ address }: any) => {
        if (address === shards[1].address) {
          return {
            amountIn: 100100000n,
            amountOut: 100000000n,
            tradeFee: 80000n,
            ownerFee: 20000n,
          };
        }
      });

      const result = await service.selectOptimalShard(
        mockClient,
        shards,
        100000000n, // Want 100 USDT
        '0xUSDC' as Address,
        '0xUSDT' as Address
      );

      // Should only consider shard 2
      expect(result.address).toBe(shards[1].address);
      expect(result.shardNumber).toBe(2);
    });

    it('should throw error when all shards have insufficient liquidity', async () => {
      const shards = [
        {
          address: '0x1111111111111111111111111111111111111111' as Address,
          shardNumber: 1,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 1000000000n,
            reserve1: 50000000n, // Only 50 USDT
          },
        },
      ];

      await expect(
        service.selectOptimalShard(
          mockClient,
          shards,
          100000000n, // Want 100 USDT - more than available
          '0xUSDC' as Address,
          '0xUSDT' as Address
        )
      ).rejects.toThrow('Insufficient liquidity across all shards');
    });

    it('should throw error when no shards are provided', async () => {
      await expect(
        service.selectOptimalShard(
          mockClient,
          [],
          100000000n,
          '0xUSDC' as Address,
          '0xUSDT' as Address
        )
      ).rejects.toThrow('No shards available for selection');
    });
  });

  describe('selectOptimalShardWithAlternatives', () => {
    it('should return optimal shard and sorted alternatives', async () => {
      const shards = [
        {
          address: '0x1111111111111111111111111111111111111111' as Address,
          shardNumber: 1,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 1000000000000n,
            reserve1: 1000000000000n,
          },
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Address,
          shardNumber: 2,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 5000000000000n,
            reserve1: 5000000000000n,
          },
        },
        {
          address: '0x3333333333333333333333333333333333333333' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          tokenA: '0xUSDC' as Address,
          tokenB: '0xUSDT' as Address,
          reserves: {
            reserve0: 10000000000000n,
            reserve1: 10000000000000n,
          },
        },
      ];

      (mockClient.readContract as any).mockImplementation(({ address }: any) => {
        if (address === shards[0].address) {
          return {
            amountIn: 100150000n, // Worst
            amountOut: 100000000n,
            tradeFee: 120000n,
            ownerFee: 30000n,
          };
        } else if (address === shards[1].address) {
          return {
            amountIn: 100100000n, // Middle
            amountOut: 100000000n,
            tradeFee: 80000n,
            ownerFee: 20000n,
          };
        } else {
          return {
            amountIn: 100080000n, // Best
            amountOut: 100000000n,
            tradeFee: 60000n,
            ownerFee: 20000n,
          };
        }
      });

      const result = await service.selectOptimalShardWithAlternatives(
        mockClient,
        shards,
        100000000n,
        '0xUSDC' as Address,
        '0xUSDT' as Address
      );

      // Optimal should be shard 3
      expect(result.optimal.shardNumber).toBe(3);
      expect(result.optimal.isOptimal).toBe(true);
      expect(result.optimal.reason).toBe('Lowest input required');

      // Alternatives should be sorted by input (best to worst)
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives[0].shardNumber).toBe(2); // Second best
      expect(result.alternatives[1].shardNumber).toBe(1); // Worst
      expect(result.alternatives[0].isOptimal).toBe(false);
      expect(result.alternatives[1].isOptimal).toBe(false);

      // All alternatives should have reasons
      expect(result.alternatives[0].reason).toContain('Higher input required');
      expect(result.alternatives[1].reason).toContain('Higher input required');
    });
  });
});
