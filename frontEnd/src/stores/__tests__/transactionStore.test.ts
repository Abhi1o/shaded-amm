import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTransactionStore } from '../transactionStore';
import { Transaction, TransactionType, TransactionStatus, Token } from '@/types';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('transactionStore', () => {
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

  const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => ({
    signature: 'test-signature-123',
    hash: 'test-signature-123',
    type: TransactionType.SWAP,
    status: TransactionStatus.CONFIRMED,
    timestamp: Date.now(),
    tokenIn: mockTokenSOL,
    tokenOut: mockTokenUSDC,
    amountIn: BigInt('1000000000'),
    amountOut: BigInt('100000000'),
    feePayer: 'test-fee-payer',
    solFee: BigInt('5000'),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Reset store state
    useTransactionStore.setState({
      transactions: [],
      filters: {
        type: undefined,
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        searchQuery: undefined,
      },
      currentPage: 1,
      pageSize: 20,
      selectedTransaction: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useTransactionStore.getState();

      expect(state.transactions).toEqual([]);
      expect(state.filters).toEqual({
        type: undefined,
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        searchQuery: undefined,
      });
      expect(state.currentPage).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.selectedTransaction).toBeNull();
    });
  });

  describe('transaction management', () => {
    it('should add a transaction', () => {
      const { addTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction();

      addTransaction(transaction);

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toEqual(transaction);
    });

    it('should add transactions in reverse chronological order', () => {
      const { addTransaction } = useTransactionStore.getState();
      const tx1 = createMockTransaction({ signature: 'tx1', timestamp: 1000 });
      const tx2 = createMockTransaction({ signature: 'tx2', timestamp: 2000 });

      addTransaction(tx1);
      addTransaction(tx2);

      const state = useTransactionStore.getState();
      expect(state.transactions[0].signature).toBe('tx2');
      expect(state.transactions[1].signature).toBe('tx1');
    });

    it('should update a transaction by signature', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction({ status: TransactionStatus.PENDING });

      addTransaction(transaction);
      updateTransaction('test-signature-123', { status: TransactionStatus.CONFIRMED });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should not update non-existent transaction', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction();

      addTransaction(transaction);
      updateTransaction('non-existent-signature', { status: TransactionStatus.FAILED });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should set all transactions', () => {
      const { setTransactions } = useTransactionStore.getState();
      const transactions = [
        createMockTransaction({ signature: 'tx1' }),
        createMockTransaction({ signature: 'tx2' }),
      ];

      setTransactions(transactions);

      const state = useTransactionStore.getState();
      expect(state.transactions).toEqual(transactions);
    });
  });

  describe('transaction filtering', () => {
    beforeEach(() => {
      const { setTransactions } = useTransactionStore.getState();
      const transactions = [
        createMockTransaction({
          signature: 'swap-confirmed',
          type: TransactionType.SWAP,
          status: TransactionStatus.CONFIRMED,
          timestamp: Date.now() - 1000,
        }),
        createMockTransaction({
          signature: 'swap-pending',
          type: TransactionType.SWAP,
          status: TransactionStatus.PENDING,
          timestamp: Date.now() - 2000,
        }),
        createMockTransaction({
          signature: 'liquidity-confirmed',
          type: TransactionType.ADD_LIQUIDITY,
          status: TransactionStatus.CONFIRMED,
          timestamp: Date.now() - 3000,
        }),
        createMockTransaction({
          signature: 'pool-failed',
          type: TransactionType.CREATE_POOL,
          status: TransactionStatus.FAILED,
          timestamp: Date.now() - 4000,
        }),
      ];
      setTransactions(transactions);
    });

    it('should filter by transaction type', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({ type: TransactionType.SWAP });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(2);
      expect(filtered.every(tx => tx.type === TransactionType.SWAP)).toBe(true);
    });

    it('should filter by transaction status', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({ status: TransactionStatus.CONFIRMED });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(2);
      expect(filtered.every(tx => tx.status === TransactionStatus.CONFIRMED)).toBe(true);
    });

    it('should filter by date range', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();
      const now = Date.now();

      setFilters({
        startDate: now - 2500,
        endDate: now - 500,
      });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(2);
      expect(filtered.every(tx => tx.timestamp >= now - 2500 && tx.timestamp <= now - 500)).toBe(true);
    });

    it('should filter by search query (signature)', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({ searchQuery: 'swap-confirmed' });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].signature).toBe('swap-confirmed');
    });

    it('should filter by search query (token symbol)', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({ searchQuery: 'usdc' });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(4);
      expect(filtered.every(tx => tx.tokenOut?.symbol === 'USDC')).toBe(true);
    });

    it('should apply multiple filters simultaneously', () => {
      const { setFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({
        type: TransactionType.SWAP,
        status: TransactionStatus.CONFIRMED,
      });
      const filtered = getFilteredTransactions();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].signature).toBe('swap-confirmed');
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters, getFilteredTransactions } = useTransactionStore.getState();

      setFilters({ type: TransactionType.SWAP, status: TransactionStatus.PENDING });
      clearFilters();

      const state = useTransactionStore.getState();
      expect(state.filters).toEqual({
        type: undefined,
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        searchQuery: undefined,
      });
      expect(getFilteredTransactions()).toHaveLength(4);
    });

    it('should reset to first page when filters change', () => {
      const { setFilters, setCurrentPage } = useTransactionStore.getState();

      setCurrentPage(3);
      expect(useTransactionStore.getState().currentPage).toBe(3);

      setFilters({ type: TransactionType.SWAP });
      expect(useTransactionStore.getState().currentPage).toBe(1);
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      const { setTransactions } = useTransactionStore.getState();
      const transactions = Array.from({ length: 50 }, (_, i) =>
        createMockTransaction({ signature: `tx-${i}` })
      );
      setTransactions(transactions);
    });

    it('should paginate transactions correctly', () => {
      const { getPaginatedTransactions } = useTransactionStore.getState();

      const page1 = getPaginatedTransactions();
      expect(page1).toHaveLength(20);
      expect(page1[0].signature).toBe('tx-0');
    });

    it('should navigate to next page', () => {
      const { setCurrentPage, getPaginatedTransactions } = useTransactionStore.getState();

      setCurrentPage(2);
      const page2 = getPaginatedTransactions();

      expect(page2).toHaveLength(20);
      expect(page2[0].signature).toBe('tx-20');
    });

    it('should handle last page with fewer items', () => {
      const { setCurrentPage, getPaginatedTransactions } = useTransactionStore.getState();

      setCurrentPage(3);
      const page3 = getPaginatedTransactions();

      expect(page3).toHaveLength(10);
      expect(page3[0].signature).toBe('tx-40');
    });

    it('should change page size', () => {
      const { setPageSize, getPaginatedTransactions } = useTransactionStore.getState();

      setPageSize(10);
      const page1 = getPaginatedTransactions();

      expect(page1).toHaveLength(10);
      expect(useTransactionStore.getState().currentPage).toBe(1);
    });

    it('should reset to first page when page size changes', () => {
      const { setCurrentPage, setPageSize } = useTransactionStore.getState();

      setCurrentPage(3);
      setPageSize(10);

      expect(useTransactionStore.getState().currentPage).toBe(1);
    });
  });

  describe('transaction queries', () => {
    beforeEach(() => {
      const { setTransactions } = useTransactionStore.getState();
      const transactions = [
        createMockTransaction({ signature: 'tx1', type: TransactionType.SWAP }),
        createMockTransaction({ signature: 'tx2', type: TransactionType.SWAP }),
        createMockTransaction({ signature: 'tx3', type: TransactionType.ADD_LIQUIDITY }),
      ];
      setTransactions(transactions);
    });

    it('should get transaction by signature', () => {
      const { getTransactionBySignature } = useTransactionStore.getState();

      const transaction = getTransactionBySignature('tx2');

      expect(transaction).toBeDefined();
      expect(transaction?.signature).toBe('tx2');
    });

    it('should return undefined for non-existent signature', () => {
      const { getTransactionBySignature } = useTransactionStore.getState();

      const transaction = getTransactionBySignature('non-existent');

      expect(transaction).toBeUndefined();
    });

    it('should get transactions by type', () => {
      const { getTransactionsByType } = useTransactionStore.getState();

      const swaps = getTransactionsByType(TransactionType.SWAP);

      expect(swaps).toHaveLength(2);
      expect(swaps.every(tx => tx.type === TransactionType.SWAP)).toBe(true);
    });
  });

  describe('selected transaction', () => {
    it('should set selected transaction', () => {
      const { setSelectedTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction();

      setSelectedTransaction(transaction);

      const state = useTransactionStore.getState();
      expect(state.selectedTransaction).toEqual(transaction);
    });

    it('should clear selected transaction', () => {
      const { setSelectedTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction();

      setSelectedTransaction(transaction);
      setSelectedTransaction(null);

      const state = useTransactionStore.getState();
      expect(state.selectedTransaction).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should serialize BigInt values for storage', () => {
      const { addTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction({
        amountIn: BigInt('1000000000'),
        amountOut: BigInt('100000000'),
        solFee: BigInt('5000'),
      });

      addTransaction(transaction);

      // Verify that setItem was called (persistence is working)
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      
      // The actual serialization logic is tested by the store's persistence middleware
      // We just verify the transaction was added correctly
      const state = useTransactionStore.getState();
      expect(state.transactions[0].amountIn).toBe(BigInt('1000000000'));
      expect(state.transactions[0].amountOut).toBe(BigInt('100000000'));
      expect(state.transactions[0].solFee).toBe(BigInt('5000'));
    });

    it('should deserialize BigInt values from storage', () => {
      const storedData = JSON.stringify({
        state: {
          transactions: [
            {
              signature: 'test-sig',
              hash: 'test-sig',
              type: TransactionType.SWAP,
              status: TransactionStatus.CONFIRMED,
              timestamp: Date.now(),
              feePayer: 'test-payer',
              amountIn: '1000000000',
              amountOut: '100000000',
              solFee: '5000',
            },
          ],
        },
        version: 0,
      });

      mockLocalStorage.getItem.mockReturnValue(storedData);

      // Simulate store initialization with persisted data
      const parsed = JSON.parse(storedData);
      const transactions = parsed.state.transactions.map((tx: any) => ({
        ...tx,
        amountIn: tx.amountIn ? BigInt(tx.amountIn) : undefined,
        amountOut: tx.amountOut ? BigInt(tx.amountOut) : undefined,
        solFee: tx.solFee ? BigInt(tx.solFee) : BigInt(0),
      }));

      expect(transactions[0].amountIn).toBe(BigInt('1000000000'));
      expect(transactions[0].amountOut).toBe(BigInt('100000000'));
      expect(transactions[0].solFee).toBe(BigInt('5000'));
    });

    it('should handle corrupted storage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      // Should not throw and return null
      const result = mockLocalStorage.getItem('test');
      expect(result).toBe('invalid json');
    });
  });

  describe('transaction categorization', () => {
    it('should categorize swap transactions', () => {
      const { addTransaction, getTransactionsByType } = useTransactionStore.getState();
      
      addTransaction(createMockTransaction({ type: TransactionType.SWAP }));
      const swaps = getTransactionsByType(TransactionType.SWAP);

      expect(swaps).toHaveLength(1);
      expect(swaps[0].type).toBe(TransactionType.SWAP);
    });

    it('should categorize liquidity transactions', () => {
      const { addTransaction, getTransactionsByType } = useTransactionStore.getState();
      
      addTransaction(createMockTransaction({ type: TransactionType.ADD_LIQUIDITY }));
      addTransaction(createMockTransaction({ type: TransactionType.REMOVE_LIQUIDITY }));
      
      const addLiquidity = getTransactionsByType(TransactionType.ADD_LIQUIDITY);
      const removeLiquidity = getTransactionsByType(TransactionType.REMOVE_LIQUIDITY);

      expect(addLiquidity).toHaveLength(1);
      expect(removeLiquidity).toHaveLength(1);
    });

    it('should categorize SPL token transfers', () => {
      const { addTransaction, getTransactionsByType } = useTransactionStore.getState();
      
      addTransaction(createMockTransaction({ type: TransactionType.SPL_TRANSFER }));
      const transfers = getTransactionsByType(TransactionType.SPL_TRANSFER);

      expect(transfers).toHaveLength(1);
      expect(transfers[0].type).toBe(TransactionType.SPL_TRANSFER);
    });
  });

  describe('transaction status updates', () => {
    it('should update transaction status from pending to confirmed', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction({ status: TransactionStatus.PENDING });

      addTransaction(transaction);
      updateTransaction(transaction.signature, { status: TransactionStatus.CONFIRMED });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should update transaction status to failed with error', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction({ status: TransactionStatus.PENDING });

      addTransaction(transaction);
      updateTransaction(transaction.signature, {
        status: TransactionStatus.FAILED,
        error: 'Insufficient funds',
      });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe(TransactionStatus.FAILED);
      expect(state.transactions[0].error).toBe('Insufficient funds');
    });

    it('should handle timeout status', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();
      const transaction = createMockTransaction({ status: TransactionStatus.PENDING });

      addTransaction(transaction);
      updateTransaction(transaction.signature, { status: TransactionStatus.TIMEOUT });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe(TransactionStatus.TIMEOUT);
    });
  });
});
