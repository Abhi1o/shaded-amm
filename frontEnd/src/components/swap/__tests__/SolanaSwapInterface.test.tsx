import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolanaSwapInterface } from '../SolanaSwapInterface';
import { useSwap } from '@/hooks/useSwap';
import { useWallet } from '@/hooks/useWallet';
import { useSolanaConnection } from '@/hooks/useSolanaConnection';
import { Token, SwapQuote, TransactionStatus } from '@/types';

// Mock all the hooks
vi.mock('@/hooks/useSwap');
vi.mock('@/hooks/useWallet');
vi.mock('@/hooks/useSolanaConnection');
vi.mock('@/services/jupiterSwapService');
vi.mock('@/components/tokens', () => ({
  TokenSelector: ({ onTokenSelect, selectedToken, placeholder }: any) => {
    const mockTokenSOL = {
      mint: 'So11111111111111111111111111111111111111112',
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      isNative: true,
    };
    
    const mockTokenUSDC = {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    };
    
    return (
      <div data-testid="token-selector">
        <span>{placeholder}</span>
        {selectedToken && <span>{selectedToken.symbol}</span>}
        <button onClick={() => onTokenSelect(mockTokenSOL)}>Select SOL</button>
        <button onClick={() => onTokenSelect(mockTokenUSDC)}>Select USDC</button>
      </div>
    );
  },
}));
vi.mock('./SwapConfirmationModal', () => ({
  SwapConfirmationModal: ({ isOpen, onConfirm, onClose }: any) => (
    isOpen ? (
      <div data-testid="swap-confirmation-modal">
        <button onClick={onConfirm}>Confirm Swap</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));
vi.mock('./SwapSettings', () => ({
  SwapSettings: ({ isOpen, onClose, onSettingsChange }: any) => (
    isOpen ? (
      <div data-testid="swap-settings">
        <button onClick={() => onSettingsChange({ slippageTolerance: 1.0 })}>
          Set 1% Slippage
        </button>
        <button onClick={onClose}>Close Settings</button>
      </div>
    ) : null
  ),
}));

const mockTokenSOL: Token = {
  mint: 'So11111111111111111111111111111111111111112',
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  isNative: true,
};

const mockTokenUSDC: Token = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
};

const mockSwapQuote: SwapQuote = {
  inputAmount: BigInt('1000000000'),
  outputAmount: BigInt('999000000'),
  minimumReceived: BigInt('989010000'),
  priceImpact: 0.1,
  exchangeRate: 0.999,
  route: [],
  routeType: 'direct',
  slippageTolerance: 0.5,
  estimatedSolFee: BigInt('5000'),
  estimatedComputeUnits: 200000,
  validUntil: Date.now() + 30000,
  refreshInterval: 10000,
};

describe('SolanaSwapInterface', () => {
  const mockUseSwap = {
    tokenIn: null,
    tokenOut: null,
    amountIn: '',
    amountOut: '',
    quote: null,
    loading: false,
    error: null,
    isSwapping: false,
    transactionStatus: null,
    transactionSignature: null,
    transactionError: null,
    showConfirmationModal: false,
    setTokenIn: vi.fn(),
    setTokenOut: vi.fn(),
    setAmountIn: vi.fn(),
    setAmountOut: vi.fn(),
    setQuote: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    swapTokens: vi.fn(),
    setIsSwapping: vi.fn(),
    setTransactionStatus: vi.fn(),
    setTransactionSignature: vi.fn(),
    setTransactionError: vi.fn(),
    setShowConfirmationModal: vi.fn(),
    resetTransaction: vi.fn(),
  };

  const mockUseWallet = {
    isConnected: false,
    tokenBalances: {},
    solBalance: BigInt(0),
    wallet: null,
  };

  const mockUseSolanaConnection = {
    connection: {
      getFeeForMessage: vi.fn(),
      sendRawTransaction: vi.fn(),
      confirmTransaction: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSwap).mockReturnValue(mockUseSwap);
    vi.mocked(useWallet).mockReturnValue(mockUseWallet);
    vi.mocked(useSolanaConnection).mockReturnValue(mockUseSolanaConnection);
  });

  describe('rendering', () => {
    it('should render swap interface with basic elements', () => {
      render(<SolanaSwapInterface />);

      expect(screen.getByText('Swap')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('should show token selectors', () => {
      render(<SolanaSwapInterface />);

      expect(screen.getByText('Select input token')).toBeInTheDocument();
      expect(screen.getByText('Select output token')).toBeInTheDocument();
    });

    it('should show settings button', () => {
      render(<SolanaSwapInterface />);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      expect(settingsButton).toBeInTheDocument();
    });
  });

  describe('wallet connection states', () => {
    it('should show "Connect Wallet" when not connected', () => {
      render(<SolanaSwapInterface />);

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('should show "Select Tokens" when connected but no tokens selected', () => {
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        isConnected: true,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('Select Tokens')).toBeInTheDocument();
    });
  });

  describe('token selection', () => {
    it('should call setTokenIn when input token is selected', () => {
      render(<SolanaSwapInterface />);

      const selectSOLButton = screen.getAllByText('Select SOL')[0];
      fireEvent.click(selectSOLButton);

      expect(mockUseSwap.setTokenIn).toHaveBeenCalledWith(mockTokenSOL);
    });

    it('should call setTokenOut when output token is selected', () => {
      render(<SolanaSwapInterface />);

      const selectUSDCButtons = screen.getAllByText('Select USDC');
      fireEvent.click(selectUSDCButtons[1]); // Second one is for output

      expect(mockUseSwap.setTokenOut).toHaveBeenCalledWith(mockTokenUSDC);
    });

    it('should display selected tokens', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        tokenOut: mockTokenUSDC,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('SOL')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });
  });

  describe('amount input', () => {
    it('should call setAmountIn when input amount changes', () => {
      render(<SolanaSwapInterface />);

      const amountInput = screen.getByPlaceholderText('0.0');
      fireEvent.change(amountInput, { target: { value: '1.5' } });

      expect(mockUseSwap.setAmountIn).toHaveBeenCalledWith('1.5');
    });

    it('should reject invalid input characters', () => {
      render(<SolanaSwapInterface />);

      const amountInput = screen.getByPlaceholderText('0.0');
      fireEvent.change(amountInput, { target: { value: 'abc' } });

      // Should not call setAmountIn for invalid input
      expect(mockUseSwap.setAmountIn).not.toHaveBeenCalledWith('abc');
    });

    it('should show MAX button and handle click', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
      });
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        tokenBalances: {
          [mockTokenSOL.mint]: BigInt('2000000000'), // 2 SOL
        },
      });

      render(<SolanaSwapInterface />);

      const maxButton = screen.getByText('MAX');
      fireEvent.click(maxButton);

      expect(mockUseSwap.setAmountIn).toHaveBeenCalledWith('2');
    });
  });

  describe('insufficient balance handling', () => {
    it('should show insufficient balance warning', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        amountIn: '5.0', // More than available
      });
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        tokenBalances: {
          [mockTokenSOL.mint]: BigInt('1000000000'), // 1 SOL
        },
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
      expect(screen.getByText('Insufficient Balance')).toBeInTheDocument();
    });
  });

  describe('quote display', () => {
    it('should show quote details when available', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        tokenOut: mockTokenUSDC,
        quote: mockSwapQuote,
        amountOut: '0.999',
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('0.10%')).toBeInTheDocument(); // Price impact
      expect(screen.getByText('0.5%')).toBeInTheDocument(); // Slippage tolerance
      expect(screen.getByText('Direct')).toBeInTheDocument(); // Route type
    });

    it('should show loading state when fetching quote', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        loading: true,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('Getting Quote...')).toBeInTheDocument();
    });
  });

  describe('price impact warnings', () => {
    it('should show high price impact warning', () => {
      const highImpactQuote = {
        ...mockSwapQuote,
        priceImpact: 6.5, // High price impact
      };

      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        quote: highImpactQuote,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('High Price Impact Warning')).toBeInTheDocument();
      expect(screen.getByText(/6.50%/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should display error messages', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        error: 'Failed to fetch quote',
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch quote')).toBeInTheDocument();
    });
  });

  describe('swap execution', () => {
    it('should show confirmation modal when swap button is clicked', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        tokenOut: mockTokenUSDC,
        amountIn: '1.0',
        quote: mockSwapQuote,
      });
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        isConnected: true,
        tokenBalances: {
          [mockTokenSOL.mint]: BigInt('2000000000'),
        },
      });

      render(<SolanaSwapInterface />);

      const swapButton = screen.getByText('Swap');
      fireEvent.click(swapButton);

      expect(mockUseSwap.setShowConfirmationModal).toHaveBeenCalledWith(true);
    });

    it('should show swapping state', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        isSwapping: true,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText('Swapping...')).toBeInTheDocument();
    });
  });

  describe('token swapping', () => {
    it('should swap token positions when swap button is clicked', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        tokenOut: mockTokenUSDC,
      });

      render(<SolanaSwapInterface />);

      // Find the swap tokens button (arrows icon)
      const swapButton = screen.getByRole('button', { name: /swap tokens/i });
      fireEvent.click(swapButton);

      expect(mockUseSwap.swapTokens).toHaveBeenCalled();
    });
  });

  describe('settings modal', () => {
    it('should open settings modal when settings button is clicked', () => {
      render(<SolanaSwapInterface />);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      expect(screen.getByTestId('swap-settings')).toBeInTheDocument();
    });

    it('should handle settings changes', () => {
      render(<SolanaSwapInterface />);

      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      // Change slippage
      const slippageButton = screen.getByText('Set 1% Slippage');
      fireEvent.click(slippageButton);

      // Settings should be updated (this would trigger quote refresh in real component)
      expect(screen.getByTestId('swap-settings')).toBeInTheDocument();
    });
  });

  describe('confirmation modal', () => {
    it('should show confirmation modal when showConfirmationModal is true', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        showConfirmationModal: true,
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByTestId('swap-confirmation-modal')).toBeInTheDocument();
    });

    it('should handle modal close', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        showConfirmationModal: true,
      });

      render(<SolanaSwapInterface />);

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(mockUseSwap.setShowConfirmationModal).toHaveBeenCalledWith(false);
    });
  });

  describe('balance display', () => {
    it('should show token balance when token is selected', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
      });
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        tokenBalances: {
          [mockTokenSOL.mint]: BigInt('1500000000'), // 1.5 SOL
        },
      });

      render(<SolanaSwapInterface />);

      expect(screen.getByText(/Balance: 1.5/)).toBeInTheDocument();
    });
  });

  describe('swap readiness', () => {
    it('should enable swap button when all conditions are met', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        tokenOut: mockTokenUSDC,
        amountIn: '1.0',
        quote: mockSwapQuote,
      });
      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        isConnected: true,
        tokenBalances: {
          [mockTokenSOL.mint]: BigInt('2000000000'),
        },
      });

      render(<SolanaSwapInterface />);

      const swapButton = screen.getByText('Swap');
      expect(swapButton).not.toBeDisabled();
    });

    it('should disable swap button when conditions are not met', () => {
      vi.mocked(useSwap).mockReturnValue({
        ...mockUseSwap,
        tokenIn: mockTokenSOL,
        // Missing tokenOut, amountIn, or quote
      });

      render(<SolanaSwapInterface />);

      const button = screen.getByText('Select Tokens');
      expect(button).toBeDisabled();
    });
  });
});