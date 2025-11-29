import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PoolCreator } from '../PoolCreator';
import { Token } from '@/types';

// Mock hooks
const mockUseWallet = vi.fn();
const mockUseTokenList = vi.fn();
const mockUsePoolCreation = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/hooks/useTokenList', () => ({
  useTokenList: () => mockUseTokenList(),
}));

vi.mock('@/hooks/usePoolCreation', () => ({
  usePoolCreation: () => mockUsePoolCreation(),
}));

// Mock components
vi.mock('@/components/tokens/TokenSelector', () => ({
  TokenSelector: ({ onTokenSelect, selectedToken, placeholder }: any) => (
    <div data-testid="token-selector">
      <span>{placeholder}</span>
      {selectedToken && <span data-testid="selected-token">{selectedToken.symbol}</span>}
      <button 
        onClick={() => onTokenSelect(mockTokenA)}
        data-testid="select-token-a"
      >
        Select Token A
      </button>
      <button 
        onClick={() => onTokenSelect(mockTokenB)}
        data-testid="select-token-b"
      >
        Select Token B
      </button>
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
  logoURI: 'https://example.com/sol.png',
};

const mockTokenB: Token = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  logoURI: 'https://example.com/usdc.png',
};

describe('PoolCreator', () => {
  const mockOnClose = vi.fn();
  const mockOnPoolCreated = vi.fn();
  const mockCreatePool = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      isConnected: true,
      tokenBalances: {
        [mockTokenA.mint]: BigInt('1000000000000'), // 1000 SOL
        [mockTokenB.mint]: BigInt('1000000000'), // 1000 USDC
      },
      publicKey: { toString: () => 'mock-public-key' },
      solBalance: BigInt('5000000000'), // 5 SOL
    });

    mockUseTokenList.mockReturnValue({
      tokens: [mockTokenA, mockTokenB],
    });

    mockUsePoolCreation.mockReturnValue({
      createPool: mockCreatePool,
      isCreating: false,
      error: null,
      clearError: mockClearError,
    });
  });

  it('renders pool creation dialog when open', () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    expect(screen.getByText('Create Liquidity Pool')).toBeInTheDocument();
    expect(screen.getByText('First Token')).toBeInTheDocument();
    expect(screen.getByText('Second Token')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <PoolCreator
        isOpen={false}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    expect(screen.queryByText('Create Liquidity Pool')).not.toBeInTheDocument();
  });

  it('shows wallet connection warning when not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      tokenBalances: {},
      publicKey: null,
      solBalance: BigInt(0),
    });

    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    expect(screen.getByText('Please connect your wallet to create a pool')).toBeInTheDocument();
  });

  it('handles token selection correctly', async () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select first token
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    
    await waitFor(() => {
      expect(screen.getByText('SOL Amount')).toBeInTheDocument();
    });

    // Select second token
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);
    
    await waitFor(() => {
      expect(screen.getByText('USDC Amount')).toBeInTheDocument();
    });
  });

  it('validates amount inputs correctly', async () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select tokens first
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);

    await waitFor(() => {
      expect(screen.getByText('SOL Amount')).toBeInTheDocument();
      expect(screen.getByText('USDC Amount')).toBeInTheDocument();
    });

    // Test invalid amount input (letters)
    const inputs = screen.getAllByDisplayValue('');
    const solAmountInput = inputs[0];
    fireEvent.change(solAmountInput, { target: { value: 'abc' } });
    
    // Input should not change for invalid characters
    expect(solAmountInput).toHaveValue('');

    // Test valid amount input
    fireEvent.change(solAmountInput, { target: { value: '10.5' } });
    expect(solAmountInput).toHaveValue('10.5');
  });

  it('shows pool information when both amounts are entered', async () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select tokens
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('');
      expect(inputs).toHaveLength(2);
    });

    // Enter amounts
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText('Pool Information')).toBeInTheDocument();
      expect(screen.getByText('Initial Price:')).toBeInTheDocument();
      expect(screen.getByText('Your share of pool:')).toBeInTheDocument();
    });
  });

  it('handles pool creation successfully', async () => {
    mockCreatePool.mockResolvedValue('mock-pool-id');

    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select tokens and enter amounts
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('');
      fireEvent.change(inputs[0], { target: { value: '10' } });
      fireEvent.change(inputs[1], { target: { value: '100' } });
    });

    // Click create pool button
    const createButton = screen.getByText('Create Pool');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreatePool).toHaveBeenCalledWith({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: BigInt('10000000000'), // 10 SOL in lamports
        amountB: BigInt('100000000'), // 100 USDC in smallest units
        feeRate: 0.25,
      });
      expect(mockOnPoolCreated).toHaveBeenCalledWith('mock-pool-id');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles pool creation errors', async () => {
    const errorMessage = 'Insufficient balance';
    mockCreatePool.mockRejectedValue(new Error(errorMessage));

    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select tokens and enter amounts
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('');
      fireEvent.change(inputs[0], { target: { value: '10' } });
      fireEvent.change(inputs[1], { target: { value: '100' } });
    });

    // Click create pool button
    const createButton = screen.getByText('Create Pool');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('disables create button when validation fails', async () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    const createButton = screen.getByText('Create Pool');
    expect(createButton).toBeDisabled();

    // Select same token for both slots (should be invalid)
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-a')[1]);

    await waitFor(() => {
      expect(createButton).toBeDisabled();
    });
  });

  it('shows loading state during pool creation', async () => {
    mockUsePoolCreation.mockReturnValue({
      createPool: mockCreatePool,
      isCreating: true,
      error: null,
      clearError: mockClearError,
    });

    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    expect(screen.getByText('Creating Pool...')).toBeInTheDocument();
  });

  it('handles MAX button clicks correctly', async () => {
    render(
      <PoolCreator
        isOpen={true}
        onClose={mockOnClose}
        onPoolCreated={mockOnPoolCreated}
      />
    );

    // Select tokens
    fireEvent.click(screen.getAllByTestId('select-token-a')[0]);
    fireEvent.click(screen.getAllByTestId('select-token-b')[1]);

    await waitFor(() => {
      expect(screen.getAllByText('MAX')).toHaveLength(2);
    });

    // Click MAX button for first token
    const maxButtons = screen.getAllByText('MAX');
    fireEvent.click(maxButtons[0]);

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('1000'); // 1000 SOL
      expect(inputs).toHaveLength(1);
    });
  });
});