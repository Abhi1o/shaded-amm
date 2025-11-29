import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Transaction, TransactionType, TransactionStatus } from '@/types';

interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
}

interface TransactionStore {
  transactions: Transaction[];
  filters: TransactionFilters;
  currentPage: number;
  pageSize: number;
  selectedTransaction: Transaction | null;
  
  // Actions
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (signature: string, updates: Partial<Transaction>) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setFilters: (filters: TransactionFilters) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSelectedTransaction: (transaction: Transaction | null) => void;
  clearFilters: () => void;
  
  // Computed getters
  getFilteredTransactions: () => Transaction[];
  getPaginatedTransactions: () => Transaction[];
  getTransactionBySignature: (signature: string) => Transaction | undefined;
  getTransactionsByType: (type: TransactionType) => Transaction[];
}

const initialFilters: TransactionFilters = {
  type: undefined,
  status: undefined,
  startDate: undefined,
  endDate: undefined,
  searchQuery: undefined,
};

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      filters: initialFilters,
      currentPage: 1,
      pageSize: 10,
      selectedTransaction: null,
      
      addTransaction: (transaction) => set((state) => ({
        transactions: [transaction, ...state.transactions],
      })),
      
      updateTransaction: (signature, updates) => set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.signature === signature ? { ...tx, ...updates } : tx
        ),
      })),
      
      setTransactions: (transactions) => set({ transactions }),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
        currentPage: 1, // Reset to first page when filters change
      })),
      
      setCurrentPage: (page) => set({ currentPage: page }),
      
      setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),
      
      setSelectedTransaction: (transaction) => set({ selectedTransaction: transaction }),
      
      clearFilters: () => set({ filters: initialFilters, currentPage: 1 }),
      
      getFilteredTransactions: () => {
        const { transactions, filters } = get();
        
        return transactions.filter((tx) => {
          // Filter by type
          if (filters.type && tx.type !== filters.type) return false;
          
          // Filter by status
          if (filters.status && tx.status !== filters.status) return false;
          
          // Filter by date range
          if (filters.startDate && tx.timestamp < filters.startDate) return false;
          if (filters.endDate && tx.timestamp > filters.endDate) return false;
          
          // Filter by search query (signature, token symbols)
          if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const matchesSignature = tx.signature.toLowerCase().includes(query);
            const matchesTokenIn = tx.tokenIn?.symbol.toLowerCase().includes(query);
            const matchesTokenOut = tx.tokenOut?.symbol.toLowerCase().includes(query);
            
            if (!matchesSignature && !matchesTokenIn && !matchesTokenOut) {
              return false;
            }
          }
          
          return true;
        });
      },
      
      getPaginatedTransactions: () => {
        const { currentPage, pageSize } = get();
        const filtered = get().getFilteredTransactions();
        
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        return filtered.slice(startIndex, endIndex);
      },
      
      getTransactionBySignature: (signature) => {
        const { transactions } = get();
        return transactions.find((tx) => tx.signature === signature);
      },
      
      getTransactionsByType: (type) => {
        const { transactions } = get();
        return transactions.filter((tx) => tx.type === type);
      },
    }),
    {
      name: 'solana-transaction-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          try {
            const parsed = JSON.parse(str);
            // Reconstruct BigInt values in transactions
            if (parsed.state?.transactions) {
              parsed.state.transactions = parsed.state.transactions.map((tx: any) => ({
                ...tx,
                amountIn: tx.amountIn ? BigInt(tx.amountIn) : undefined,
                amountOut: tx.amountOut ? BigInt(tx.amountOut) : undefined,
                solFee: tx.solFee ? BigInt(tx.solFee) : BigInt(0),
              }));
            }
            return parsed;
          } catch (error) {
            console.error('Failed to parse stored transaction state:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // Convert BigInt to string for storage
            const serializable = {
              ...value,
              state: {
                ...value.state,
                transactions: value.state?.transactions?.map((tx: Transaction) => ({
                  ...tx,
                  amountIn: tx.amountIn?.toString(),
                  amountOut: tx.amountOut?.toString(),
                  solFee: tx.solFee?.toString(),
                })) || [],
              }
            };
            localStorage.setItem(name, JSON.stringify(serializable));
          } catch (error) {
            console.error('Failed to store transaction state:', error);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({
        transactions: state.transactions,
      } as unknown as TransactionStore),
    }
  )
);
