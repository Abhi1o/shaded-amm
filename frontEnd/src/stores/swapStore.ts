import { create } from 'zustand';
import { SwapQuote, Token, TransactionStatus } from '@/types';

interface SwapStore {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  quote: SwapQuote | null;
  loading: boolean;
  error: string | null;
  
  // Transaction state
  isSwapping: boolean;
  transactionStatus: TransactionStatus | null;
  transactionSignature: string | null;
  transactionError: string | null;
  showConfirmationModal: boolean;
  
  setTokenIn: (token: Token | null) => void;
  setTokenOut: (token: Token | null) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setQuote: (quote: SwapQuote | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  swapTokens: () => void;
  
  // Transaction actions
  setIsSwapping: (isSwapping: boolean) => void;
  setTransactionStatus: (status: TransactionStatus | null) => void;
  setTransactionSignature: (signature: string | null) => void;
  setTransactionError: (error: string | null) => void;
  setShowConfirmationModal: (show: boolean) => void;
  resetTransaction: () => void;
}

export const useSwapStore = create<SwapStore>((set, get) => ({
  tokenIn: null,
  tokenOut: null,
  amountIn: '',
  amountOut: '',
  quote: null,
  loading: false,
  error: null,
  
  // Transaction state
  isSwapping: false,
  transactionStatus: null,
  transactionSignature: null,
  transactionError: null,
  showConfirmationModal: false,
  
  setTokenIn: (token) => set({ tokenIn: token }),
  setTokenOut: (token) => set({ tokenOut: token }),
  setAmountIn: (amount) => set({ amountIn: amount }),
  setAmountOut: (amount) => set({ amountOut: amount }),
  setQuote: (quote) => set({ quote }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  swapTokens: () => {
    const { tokenIn, tokenOut } = get();
    set({
      tokenIn: tokenOut,
      tokenOut: tokenIn,
      amountIn: '',
      amountOut: '',
      quote: null,
    });
  },
  
  // Transaction actions
  setIsSwapping: (isSwapping) => set({ isSwapping }),
  setTransactionStatus: (status) => set({ transactionStatus: status }),
  setTransactionSignature: (signature) => set({ transactionSignature: signature }),
  setTransactionError: (error) => set({ transactionError: error }),
  setShowConfirmationModal: (show) => set({ showConfirmationModal: show }),
  
  resetTransaction: () => set({
    isSwapping: false,
    transactionStatus: null,
    transactionSignature: null,
    transactionError: null,
    showConfirmationModal: false,
  }),
}));