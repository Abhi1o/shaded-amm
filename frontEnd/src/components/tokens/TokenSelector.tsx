'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { useTokenList } from '@/hooks/useTokenList';
import { useWallet } from '@/hooks/useWallet';
import { TokenLogo } from './TokenLogo';
import { formatTokenAmount } from '@/utils/formatting';

interface TokenSelectorProps {
  selectedToken?: Token | null;
  onTokenSelect: (token: Token | null) => void;
  excludeTokens?: string[]; // Mint addresses to exclude
  showBalance?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function TokenSelector({
  selectedToken,
  onTokenSelect,
  excludeTokens = [],
  showBalance = true,
  disabled = false,
  placeholder = 'Select token'
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { tokens, loading, searchTokens, addCustomToken } = useTokenList();
  const { tokenBalances } = useWallet();

  // Filter tokens based on search query and exclusions
  const filteredTokens = useMemo(() => {
    let filtered = tokens.filter(token => 
      !excludeTokens.includes(token.mint) &&
      (query === '' || 
       token.symbol.toLowerCase().includes(query.toLowerCase()) ||
       token.name.toLowerCase().includes(query.toLowerCase()) ||
       token.mint.toLowerCase().includes(query.toLowerCase()))
    );

    // Sort by balance (if showing balances) and then by symbol
    if (showBalance && tokenBalances) {
      filtered.sort((a, b) => {
        const balanceA = tokenBalances[a.mint] || BigInt(0);
        const balanceB = tokenBalances[b.mint] || BigInt(0);
        
        if (balanceA !== balanceB) {
          return balanceA > balanceB ? -1 : 1;
        }
        
        return a.symbol.localeCompare(b.symbol);
      });
    } else {
      filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    return filtered;
  }, [tokens, query, excludeTokens, tokenBalances, showBalance]);

  // Handle custom token import
  const handleCustomTokenImport = async (mintAddress: string) => {
    try {
      const customToken = await addCustomToken(mintAddress);
      if (customToken) {
        onTokenSelect(customToken);
        setIsOpen(false);
        setQuery('');
      }
    } catch (error) {
      console.error('Failed to import custom token:', error);
    }
  };

  // Check if query looks like a mint address (base58, ~44 characters)
  const isValidMintAddress = (address: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleTokenSelect = (token: Token | null) => {
    onTokenSelect(token);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`
          flex items-center justify-between w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}
        `}
      >
        <div className="flex items-center space-x-2">
          {selectedToken ? (
            <>
              <TokenLogo token={selectedToken} size="sm" />
              <div>
                <div className="font-medium text-gray-900">{selectedToken.symbol}</div>
                {showBalance && tokenBalances && (
                  <div className="text-sm text-gray-500">
                    {formatTokenAmount(tokenBalances[selectedToken.mint] || BigInt(0), selectedToken.decimals)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/25" />
        
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  Select Token
                </Dialog.Title>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <Combobox value={selectedToken} onChange={handleTokenSelect}>
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Combobox.Input
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Search by name, symbol, or mint address"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>

                  <Combobox.Options className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {loading ? (
                      <div className="px-4 py-2 text-sm text-gray-500">Loading tokens...</div>
                    ) : filteredTokens.length === 0 ? (
                      <div className="px-4 py-2">
                        {query && isValidMintAddress(query) ? (
                          <button
                            onClick={() => handleCustomTokenImport(query)}
                            className="w-full text-left text-sm text-blue-600 hover:text-blue-800"
                          >
                            Import custom token: {query.slice(0, 8)}...{query.slice(-8)}
                          </button>
                        ) : (
                          <div className="text-sm text-gray-500">No tokens found</div>
                        )}
                      </div>
                    ) : (
                      filteredTokens.map((token) => (
                        <Combobox.Option
                          key={token.mint}
                          value={token}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 px-4 ${
                              active ? 'bg-blue-600 text-white' : 'text-gray-900'
                            }`
                          }
                        >
                          {({ active }) => (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <TokenLogo token={token} size="sm" />
                                <div>
                                  <div className={`font-medium ${active ? 'text-white' : 'text-gray-900'}`}>
                                    {token.symbol}
                                  </div>
                                  <div className={`text-sm ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                                    {token.name}
                                  </div>
                                </div>
                              </div>
                              {showBalance && tokenBalances && (
                                <div className={`text-sm ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {formatTokenAmount(tokenBalances[token.mint] || BigInt(0), token.decimals)}
                                </div>
                              )}
                            </div>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </div>
              </Combobox>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </>
  );
}