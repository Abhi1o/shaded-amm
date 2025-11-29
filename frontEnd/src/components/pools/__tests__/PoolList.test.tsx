import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PoolList } from '../PoolList';
import { Pool, Token } from '@/types';
import { PublicKey } from '@solana/web3.js';

// Mock hooks
const mockUsePools = vi.fn();
const mockUsePoolRefresh = vi.fn();

vi.mock('@/hooks/usePools', () => ({
  usePools: () => mockUsePools(),
}));

vi.mock('@/hooks/usePoolRefresh', () => ({
  usePoolRefresh: () => mockUsePoolRefresh(),
}));

// Mock components
vi.mock('@/components/tokens/TokenLogo', () => ({
  TokenLogo: ({ token, size }: { token: Token; size: string }) => (
    <div data-testid={`token-logo-${token.symbol}-${size}`}>
      {token.symbol}
    </div>
  ),
}));

// Mock token data
const mockTokenA: Token = {
  mint: 'So11111111111111111111111111111111111111112',
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
};

const mockTokenB: Token = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
};

const mockTokenC: Token = {
  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
};

// Mock pool data
const createMockPool = (
  id: string,
  tokenA: Token,
  tokenB: Token,
  liquidity: string,
  volume24h: string,
  fees24h: string,
  isActive: boolean = true,
  ammType: 'constant_product' | 'stable' | 'concentrated' = 'constant_product'
): Pool => ({
  id,
  programId: 'mock-program-id',
  tokenA,
  tokenB,
  tokenAAccount: new PublicKey('11111111111111111111111111111111'),
  tokenBAccount: new PublicKey('11111111111111111111111111111111'),
  lpTokenMint: new PublicKey('11111111111111111111111111111111'),
  reserveA: BigInt(liquidity),
  reserveB: BigInt(liquidity),
  totalLiquidity: BigInt(liquidity),
  lpTokenSupply: BigInt('1000000000'),
  volume24h: BigInt(volume24h),
  fees24h: BigInt(fees24h),
  feeRate: 0.25,
  isActive,
  createdAt: Date.now() - 86400000, // 1 day ago
  lastUpdated: Date.now(),
  ammType,
});

const mockPools: Pool[] = [
  createMockPool('pool1', mockTokenA, mockTokenB, '5000000000000', '1000000000000', '2500000000'),
  createMockPool('pool2', mockTokenA, mockTokenC, '3000000000000', '500000000000', '1250000000'),
  createMockPool('pool3', mockTokenB, mockTokenC, '1000000000000', '100000000000', '250000000', false),
];

describe('PoolList', () => {
  const mockOnPoolSelect = vi.fn();
  const mockOnCreatePool = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUsePools.mockReturnValue({
      pools: mockPools,
      loading: false,
      error: null,
    });
    
    mockUsePoolRefresh.mockReturnValue({
      isRefreshing: false,
      isStale: false,
      manualRefresh: vi.fn(),
      error: null,
      lastRefreshTime: Date.now(),
      consecutiveFailures: 0,
      currentBackoffDelay: 1000,
    });
  });

  it('renders pool list with correct data', () => {
    render(
      <PoolList
        onPoolSelect={mockOnPoolSelect}
        onCreatePool={mockOnCreatePool}
      />
    );

    expect(screen.getByText('Liquidity Pools')).toBeInTheDocument();
    expect(screen.getByText('3 pools • 2 active')).toBeInTheDocument();
    expect(screen.getByText('Create Pool')).toBeInTheDocument();
  });

  it('displays pool statistics correctly', () => {
    render(<PoolList />);

    expect(screen.getByText('Total Liquidity')).toBeInTheDocument();
    expect(screen.getByText('24h Volume')).toBeInTheDocument();
    expect(screen.getByText('Active Pools')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Active pools count
  });

  it('renders individual pool cards with correct information', () => {
    render(<PoolList onPoolSelect={mockOnPoolSelect} />);

    // Check for token pair names
    expect(screen.getByText('SOL/USDC')).toBeInTheDocument();
    expect(screen.getByText('SOL/USDT')).toBeInTheDocument();
    expect(screen.getByText('USDC/USDT')).toBeInTheDocument();

    // Check for pool metrics
    expect(screen.getByText('5.00 SOL')).toBeInTheDocument(); // Liquidity for pool1
    expect(screen.getByText('1.00 SOL')).toBeInTheDocument(); // Volume for pool1
  });

  it('handles pool selection correctly', () => {
    render(<PoolList onPoolSelect={mockOnPoolSelect} />);

    const poolCard = screen.getByText('SOL/USDC').closest('div');
    fireEvent.click(poolCard!);

    expect(mockOnPoolSelect).toHaveBeenCalledWith(mockPools[0]);
  });

  it('handles create pool button click', () => {
    render(<PoolList onCreatePool={mockOnCreatePool} />);

    const createButton = screen.getByText('Create Pool');
    fireEvent.click(createButton);

    expect(mockOnCreatePool).toHaveBeenCalled();
  });

  it('filters pools by search query', async () => {
    render(<PoolList />);

    const searchInput = screen.getByPlaceholderText('Search pools by token name or symbol...');
    fireEvent.change(searchInput, { target: { value: 'USDC' } });

    await waitFor(() => {
      expect(screen.getByText('SOL/USDC')).toBeInTheDocument();
      expect(screen.getByText('USDC/USDT')).toBeInTheDocument();
      expect(screen.queryByText('SOL/USDT')).not.toBeInTheDocument();
    });
  });

  it('sorts pools by different criteria', async () => {
    render(<PoolList />);

    // Click on Volume sort button
    const volumeButton = screen.getByText('24h Volume');
    fireEvent.click(volumeButton);

    // Verify sorting indicator appears
    await waitFor(() => {
      expect(volumeButton.closest('button')).toHaveClass('bg-blue-100');
    });
  });

  it('shows and hides advanced filters', () => {
    render(<PoolList />);

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    expect(screen.getByText('Min Liquidity (SOL)')).toBeInTheDocument();
    expect(screen.getByText('Token Symbol')).toBeInTheDocument();
    expect(screen.getByText('AMM Type')).toBeInTheDocument();
  });

  it('filters pools by minimum liquidity', async () => {
    render(<PoolList />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Set minimum liquidity filter
    const minLiquidityInput = screen.getByPlaceholderText('0');
    fireEvent.change(minLiquidityInput, { target: { value: '4' } });

    await waitFor(() => {
      // Only pool1 (5 SOL) should be visible, pool2 (3 SOL) and pool3 (1 SOL) should be hidden
      expect(screen.getByText('SOL/USDC')).toBeInTheDocument();
      expect(screen.queryByText('SOL/USDT')).not.toBeInTheDocument();
      expect(screen.queryByText('USDC/USDT')).not.toBeInTheDocument();
    });
  });

  it('filters pools by token symbol', async () => {
    render(<PoolList />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Set token symbol filter
    const tokenSymbolInput = screen.getByPlaceholderText('SOL, USDC, etc.');
    fireEvent.change(tokenSymbolInput, { target: { value: 'SOL' } });

    await waitFor(() => {
      expect(screen.getByText('SOL/USDC')).toBeInTheDocument();
      expect(screen.getByText('SOL/USDT')).toBeInTheDocument();
      expect(screen.queryByText('USDC/USDT')).not.toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockUsePools.mockReturnValue({
      pools: [],
      loading: true,
      error: null,
    });

    render(<PoolList />);

    expect(screen.getByText('Liquidity Pools')).toBeInTheDocument();
    expect(screen.getByText('Create Pool')).toBeInTheDocument();
    
    // Check for loading skeletons
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    const errorMessage = 'Failed to load pools';
    mockUsePools.mockReturnValue({
      pools: [],
      loading: false,
      error: errorMessage,
    });

    render(<PoolList />);

    expect(screen.getByText('Failed to load pools')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows empty state when no pools match filters', async () => {
    render(<PoolList />);

    const searchInput = screen.getByPlaceholderText('Search pools by token name or symbol...');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

    await waitFor(() => {
      expect(screen.getByText('No pools found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    });
  });

  it('shows empty state when no pools exist', () => {
    mockUsePools.mockReturnValue({
      pools: [],
      loading: false,
      error: null,
    });

    render(<PoolList />);

    expect(screen.getByText('No pools found')).toBeInTheDocument();
    expect(screen.getByText('No liquidity pools available yet')).toBeInTheDocument();
  });

  it('displays pool status indicators correctly', () => {
    render(<PoolList />);

    // Check for active and inactive status indicators
    const poolCards = screen.getAllByRole('generic').filter(el => 
      el.className.includes('bg-white border border-gray-200')
    );
    
    // Should have status indicators for each pool
    expect(screen.getAllByRole('generic').filter(el => 
      el.className.includes('bg-green-500') || el.className.includes('bg-red-500')
    ).length).toBeGreaterThan(0);
  });

  it('hides create button when showCreateButton is false', () => {
    render(<PoolList showCreateButton={false} />);

    expect(screen.queryByText('Create Pool')).not.toBeInTheDocument();
  });

  it('reverses sort direction when clicking same sort field', async () => {
    render(<PoolList />);

    const liquidityButton = screen.getByText('Liquidity');
    
    // First click - should sort descending (default)
    fireEvent.click(liquidityButton);
    await waitFor(() => {
      expect(liquidityButton.closest('button')).toHaveClass('bg-blue-100');
    });

    // Second click - should reverse to ascending
    fireEvent.click(liquidityButton);
    await waitFor(() => {
      // The sort direction should change (indicated by rotated arrow)
      const arrow = liquidityButton.parentElement?.querySelector('svg');
      expect(arrow).toHaveClass('rotate-180');
    });
  });
});