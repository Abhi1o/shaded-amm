'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Token, TokenListResponse } from '@/types';
import { useSolanaConnection } from './useSolanaConnection';

// Solana Token Registry URLs (with fallbacks)
const TOKEN_LIST_URLS = [
  'https://token.jup.ag/strict',
  'https://tokens.jup.ag/all',
  'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json',
];

// Popular Solana tokens for fallback
const POPULAR_TOKENS: Token[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    isNative: true,
    tags: ['verified']
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    tags: ['verified', 'stablecoin']
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    tags: ['verified', 'stablecoin']
  }
];

interface UseTokenListReturn {
  tokens: Token[];
  loading: boolean;
  error: string | null;
  favoriteTokens: string[];
  searchTokens: (query: string) => Token[];
  addCustomToken: (mintAddress: string) => Promise<Token | null>;
  toggleFavorite: (mintAddress: string) => void;
  refreshTokenList: () => Promise<void>;
}

export function useTokenList(): UseTokenListReturn {
  const [tokens, setTokens] = useState<Token[]>(POPULAR_TOKENS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTokens, setFavoriteTokens] = useState<string[]>([]);
  const { connection } = useSolanaConnection();

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('solana-dex-favorite-tokens');
    if (savedFavorites) {
      try {
        setFavoriteTokens(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorite tokens:', e);
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((favorites: string[]) => {
    localStorage.setItem('solana-dex-favorite-tokens', JSON.stringify(favorites));
  }, []);

  // Fetch token list from Solana Token Registry with fallbacks
  const fetchTokenList = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try each URL until one succeeds
    for (const url of TOKEN_LIST_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          continue; // Try next URL
        }

        const data: TokenListResponse = await response.json();
        
        // Transform tokens to our format
        const transformedTokens: Token[] = (data.tokens || []).map(token => ({
          mint: token.address || token.mint,
          address: token.address || token.mint,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          tags: token.tags,
          extensions: token.extensions
        }));

        // Merge with popular tokens, avoiding duplicates
        const allTokens = [...POPULAR_TOKENS];
        transformedTokens.forEach(token => {
          if (!allTokens.find(existing => existing.mint === token.mint)) {
            allTokens.push(token);
          }
        });

        setTokens(allTokens);
        setLoading(false);
        return; // Success, exit function
      } catch (err) {
        // Continue to next URL if this one fails
        if (err instanceof Error && err.name !== 'AbortError') {
          // Only log non-timeout errors
          continue;
        }
      }
    }

    // All URLs failed - use fallback
    console.warn('Token list API unavailable, using fallback tokens');
    setTokens(POPULAR_TOKENS);
    setError(null); // Don't show error to user, fallback works
    setLoading(false);
  }, []);

  // Initial token list fetch
  useEffect(() => {
    fetchTokenList();
  }, [fetchTokenList]);

  // Search tokens by query
  const searchTokens = useCallback((query: string): Token[] => {
    if (!query.trim()) return tokens;

    const lowercaseQuery = query.toLowerCase();
    return tokens.filter(token =>
      token.symbol.toLowerCase().includes(lowercaseQuery) ||
      token.name.toLowerCase().includes(lowercaseQuery) ||
      token.mint.toLowerCase().includes(lowercaseQuery)
    );
  }, [tokens]);

  // Add custom token by mint address
  const addCustomToken = useCallback(async (mintAddress: string): Promise<Token | null> => {
    try {
      // Validate mint address format
      if (!mintAddress || mintAddress.length < 32) {
        throw new Error('Invalid mint address format');
      }

      // Check if token already exists
      const existingToken = tokens.find(token => token.mint === mintAddress);
      if (existingToken) {
        return existingToken;
      }

      // Validate as PublicKey
      const mintPubkey = new PublicKey(mintAddress);
      
      // Fetch token metadata from blockchain
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
      
      if (!mintInfo.value || !mintInfo.value.data || typeof (mintInfo.value.data as any) === 'string') {
        throw new Error('Invalid token mint address');
      }

      const parsedData = mintInfo.value.data as any;
      if (parsedData.program !== 'spl-token' || parsedData.parsed?.type !== 'mint') {
        throw new Error('Address is not a valid SPL token mint');
      }

      const mintData = parsedData.parsed.info;
      
      // Create token object with basic info
      const customToken: Token = {
        mint: mintAddress,
        address: mintAddress,
        symbol: `TOKEN_${mintAddress.slice(0, 4)}`, // Fallback symbol
        name: `Custom Token ${mintAddress.slice(0, 8)}...`, // Fallback name
        decimals: mintData.decimals || 0,
        tags: ['custom']
      };

      // Try to fetch metadata from common sources
      try {
        // Try Jupiter API for token info
        const jupiterResponse = await fetch(`https://tokens.jup.ag/token/${mintAddress}`);
        if (jupiterResponse.ok) {
          const jupiterData = await jupiterResponse.json();
          customToken.symbol = jupiterData.symbol || customToken.symbol;
          customToken.name = jupiterData.name || customToken.name;
          customToken.logoURI = jupiterData.logoURI;
        }
      } catch (e) {
        // Ignore metadata fetch errors, use basic info
        console.warn('Failed to fetch token metadata:', e);
      }

      // Add to token list
      setTokens(prevTokens => [...prevTokens, customToken]);
      
      return customToken;
    } catch (err) {
      console.error('Failed to add custom token:', err);
      throw err;
    }
  }, [tokens, connection]);

  // Toggle favorite token
  const toggleFavorite = useCallback((mintAddress: string) => {
    setFavoriteTokens(prevFavorites => {
      const newFavorites = prevFavorites.includes(mintAddress)
        ? prevFavorites.filter(mint => mint !== mintAddress)
        : [...prevFavorites, mintAddress];
      
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, [saveFavorites]);

  // Refresh token list
  const refreshTokenList = useCallback(async () => {
    await fetchTokenList();
  }, [fetchTokenList]);

  return {
    tokens,
    loading,
    error,
    favoriteTokens,
    searchTokens,
    addCustomToken,
    toggleFavorite,
    refreshTokenList
  };
}