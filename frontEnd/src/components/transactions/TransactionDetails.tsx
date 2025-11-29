'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTransactionStore } from '@/stores/transactionStore';
import { TransactionType, TransactionStatus } from '@/types';
import { XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const EXPLORER_URLS = {
  mainnet: 'https://solscan.io',
  devnet: 'https://solscan.io',
  testnet: 'https://solscan.io',
  solanaFM: 'https://solana.fm',
};

const formatDateTime = (ts: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.SWAP]: 'Token Swap',
  [TransactionType.ADD_LIQUIDITY]: 'Add Liquidity',
  [TransactionType.REMOVE_LIQUIDITY]: 'Remove Liquidity',
  [TransactionType.CREATE_POOL]: 'Create Pool',
  [TransactionType.SPL_TRANSFER]: 'SPL Token Transfer',
  [TransactionType.SOL_TRANSFER]: 'SOL Transfer',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [TransactionStatus.CONFIRMED]: 'bg-green-100 text-green-800 border-green-200',
  [TransactionStatus.FAILED]: 'bg-red-100 text-red-800 border-red-200',
  [TransactionStatus.CANCELLED]: 'bg-gray-100 text-gray-800 border-gray-200',
  [TransactionStatus.TIMEOUT]: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function TransactionDetails() {
  const { selectedTransaction, setSelectedTransaction } = useTransactionStore();

  const isOpen = selectedTransaction !== null;

  const closeModal = () => {
    setSelectedTransaction(null);
  };

  const formatAmount = (amount: bigint | undefined, decimals: number = 9) => {
    if (!amount) return '0';
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatSolFee = (fee: bigint) => {
    const solFee = Number(fee) / 1e9;
    return solFee.toFixed(9);
  };

  const getExplorerUrl = (signature: string, explorer: 'solscan' | 'solanaFM' = 'solscan', cluster: string = 'devnet') => {
    if (explorer === 'solanaFM') {
      return `${EXPLORER_URLS.solanaFM}/tx/${signature}?cluster=${cluster}`;
    }
    const baseUrl = EXPLORER_URLS[cluster as keyof typeof EXPLORER_URLS] || EXPLORER_URLS.devnet;
    return `${baseUrl}/tx/${signature}?cluster=${cluster}`;
  };

  if (!selectedTransaction) return null;

  const tx = selectedTransaction;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Transaction Details
                  </Dialog.Title>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="mb-6">
                  <span
                    className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full border ${
                      STATUS_COLORS[tx.status]
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>

                {/* Transaction Info */}
                <div className="space-y-4">
                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <p className="text-sm text-gray-900">{TRANSACTION_TYPE_LABELS[tx.type]}</p>
                  </div>

                  {/* Signature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Signature
                    </label>
                    <p className="text-sm text-gray-900 font-mono break-all">{tx.signature}</p>
                  </div>

                  {/* Transaction Details */}
                  {tx.tokenIn && tx.tokenOut && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction Details
                      </label>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">From:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatAmount(tx.amountIn, tx.tokenIn.decimals)} {tx.tokenIn.symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">To:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatAmount(tx.amountOut, tx.tokenOut.decimals)} {tx.tokenOut.symbol}
                          </span>
                        </div>
                        {tx.priceImpact !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Price Impact:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {tx.priceImpact.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timestamp
                    </label>
                    <p className="text-sm text-gray-900">
                      {formatDateTime(tx.timestamp)}
                    </p>
                  </div>

                  {/* Block Time */}
                  {tx.blockTime && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Block Time
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDateTime(tx.blockTime * 1000)}
                      </p>
                    </div>
                  )}

                  {/* Slot */}
                  {tx.slot && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slot
                      </label>
                      <p className="text-sm text-gray-900">{tx.slot.toLocaleString()}</p>
                    </div>
                  )}

                  {/* Fee */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction Fee
                    </label>
                    <p className="text-sm text-gray-900">{formatSolFee(tx.solFee)} SOL</p>
                  </div>

                  {/* Compute Units */}
                  {tx.computeUnitsUsed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Compute Units Used
                      </label>
                      <p className="text-sm text-gray-900">{tx.computeUnitsUsed.toLocaleString()}</p>
                    </div>
                  )}

                  {/* Error */}
                  {tx.error && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">
                        Error
                      </label>
                      <p className="text-sm text-red-600 bg-red-50 rounded p-2 font-mono">
                        {tx.error}
                      </p>
                    </div>
                  )}

                  {/* Logs */}
                  {tx.logs && tx.logs.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction Logs
                      </label>
                      <div className="bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono max-h-48 overflow-y-auto">
                        {tx.logs.map((log, index) => (
                          <div key={index} className="mb-1">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explorer Links */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    View on Explorer
                  </label>
                  <div className="flex space-x-3">
                    <a
                      href={getExplorerUrl(tx.signature, 'solscan')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Solscan
                      <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href={getExplorerUrl(tx.signature, 'solanaFM')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Solana FM
                      <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-6">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
