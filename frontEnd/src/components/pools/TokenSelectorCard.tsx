'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { TokenLogo } from '@/components/tokens/TokenLogo';

interface TokenSelectorCardProps {
  label: string;
  selectedToken: Token | null;
  availableTokens: Token[];
  isExpanded: boolean;
  onTokenSelect: (token: Token) => void;
  onToggleExpand: () => void;
  disabled?: boolean;
  excludeToken?: string; // Mint address to exclude
}

export function TokenSelectorCard({
  label,
  selectedToken,
  availableTokens,
  isExpanded,
  onTokenSelect,
  onToggleExpand,
  disabled = false,
  excludeToken,
}: TokenSelectorCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Detect mobile for optimized animations
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Animation duration based on device
  const animationDuration = isMobile ? 0.25 : 0.3;

  // Filter tokens based on search query and exclusion
  const filteredTokens = availableTokens.filter((token) => {
    if (excludeToken && token.mint === excludeToken) {
      return false;
    }
    if (!searchQuery) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query)
    );
  });

  // Auto-focus search input when expanded
  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isExpanded]);

  // Reset search and focus when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setSearchQuery('');
      setFocusedIndex(-1);
    }
  }, [isExpanded]);

  // Handle token selection
  const handleTokenSelect = (token: Token) => {
    onTokenSelect(token);
    setSearchQuery('');
    setFocusedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isExpanded) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleExpand();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredTokens.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredTokens[focusedIndex]) {
          handleTokenSelect(filteredTokens[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onToggleExpand();
        break;
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [focusedIndex]);

  return (
    <motion.div
      className="w-full"
      initial={false}
      animate={isExpanded ? 'expanded' : 'minimized'}
      onKeyDown={handleKeyDown}
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // Expanded State
          <motion.div
            key="expanded"
            initial={{ height: 64, opacity: 1 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                duration: animationDuration,
                ease: [0.25, 0.4, 0.25, 1],
              },
            }}
            exit={{
              height: 64,
              opacity: 1,
              transition: {
                duration: animationDuration,
                ease: [0.25, 0.4, 0.25, 1],
              },
            }}
            style={{ willChange: isExpanded ? 'height, opacity' : 'auto' }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-6 overflow-hidden"
            role="combobox"
            aria-expanded={isExpanded}
            aria-label={`${label} selector`}
            aria-controls="token-list"
            aria-haspopup="listbox"
          >
            <div className="mb-4 md:mb-4">
              <label className="block text-sm md:text-sm font-medium text-white/70 mb-3 md:mb-2">
                {label}
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 md:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 md:w-5 md:h-5 text-white/40 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-full pl-12 md:pl-12 pr-4 md:pr-4 py-3.5 md:py-3 min-h-[48px] md:min-h-[44px] bg-white/5 border border-white/10 rounded-2xl text-base md:text-base text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  aria-label="Search tokens"
                  aria-autocomplete="list"
                  aria-controls="token-list"
                />
              </div>
            </div>

            <div
              ref={listRef}
              id="token-list"
              role="listbox"
              aria-label="Available tokens"
              className="max-h-72 md:max-h-64 overflow-y-auto space-y-2 md:space-y-1 custom-scrollbar pr-1"
              style={{
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              }}
            >
              {filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-white/50">
                  No tokens found
                </div>
              ) : (
                filteredTokens.map((token, index) => (
                  <motion.button
                    key={token.mint}
                    type="button"
                    onClick={() => handleTokenSelect(token)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`w-full flex items-center gap-3 md:gap-3 p-4 md:p-3 min-h-[56px] md:min-h-[48px] rounded-xl md:rounded-xl transition-all touch-manipulation ${
                      focusedIndex === index
                        ? 'bg-white/10 border border-white/20'
                        : selectedToken?.mint === token.mint
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'hover:bg-white/8 active:bg-white/10 active:scale-[0.98] border border-transparent'
                    }`}
                    role="option"
                    aria-selected={selectedToken?.mint === token.mint}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    <TokenLogo token={token} size="md" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-white text-base md:text-base truncate">
                        {token.displaySymbol || token.symbol}
                      </div>
                      <div className="text-sm md:text-sm text-white/60 truncate">{token.name}</div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          // Minimized State
          <motion.button
            key="minimized"
            type="button"
            onClick={onToggleExpand}
            disabled={disabled}
            initial={{ height: 'auto', opacity: 1 }}
            animate={{
              height: 64,
              opacity: 1,
              transition: {
                duration: animationDuration,
                ease: [0.25, 0.4, 0.25, 1],
              },
            }}
            exit={{
              height: 'auto',
              opacity: 1,
              transition: {
                duration: animationDuration,
                ease: [0.25, 0.4, 0.25, 1],
              },
            }}
            style={{ willChange: !isExpanded ? 'height, opacity' : 'auto' }}
            className={`w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-5 md:px-5 py-4 md:py-4 min-h-[68px] md:min-h-[64px] flex items-center justify-between transition-all touch-manipulation ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white/8 hover:border-white/20 active:bg-white/10 active:scale-[0.99]'
            }`}
            aria-label={`${label}: ${selectedToken ? selectedToken.symbol : 'Not selected'}`}
            aria-expanded={false}
          >
            {selectedToken ? (
              <motion.div
                className="flex items-center gap-3 md:gap-3 min-w-0 flex-1"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: {
                    duration: 0.2,
                    ease: [0.25, 0.4, 0.25, 1],
                  },
                }}
              >
                <TokenLogo token={selectedToken} size="md" />
                <div className="text-left min-w-0 flex-1">
                  <div className="font-medium text-white text-base md:text-base truncate">
                    {selectedToken.displaySymbol || selectedToken.symbol}
                  </div>
                  <div className="text-sm md:text-sm text-white/60 truncate">
                    {selectedToken.name}
                  </div>
                </div>
              </motion.div>
            ) : (
              <span className="text-white/50 text-base md:text-base">{label}</span>
            )}
            <ChevronDownIcon className="w-6 h-6 md:w-5 md:h-5 text-white/40 flex-shrink-0 ml-2" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
