"use client";

import React from "react";
import Image from "next/image";

interface TokenIconProps {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
};

// Token icon URLs from Solana token list (official logos)
const tokenIcons: { [key: string]: string } = {
  USDC: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  SOL: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  USDT: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  ETH: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk/logo.png",
  BTC: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png",
  BNB: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png",
  MATIC: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/matic.png",
  AVAX: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/avax.png",
};

// Gradient fallback colors for tokens without icons
const tokenGradients: { [key: string]: string } = {
  USDC: "from-blue-400 to-blue-600",
  SOL: "from-purple-400 to-pink-500",
  USDT: "from-green-400 to-green-600",
  ETH: "from-indigo-400 to-purple-600",
  BTC: "from-orange-400 to-yellow-500",
  BNB: "from-yellow-400 to-orange-500",
  MATIC: "from-purple-500 to-indigo-600",
  AVAX: "from-red-400 to-pink-500",
};

export function TokenIcon({ symbol, size = "md", className = "" }: TokenIconProps) {
  const [imageError, setImageError] = React.useState(false);
  const iconUrl = tokenIcons[symbol.toUpperCase()];
  const gradient = tokenGradients[symbol.toUpperCase()] || "from-gray-400 to-gray-600";

  // If no icon URL or image failed to load, show gradient fallback
  if (!iconUrl || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-lg border-2 border-white/20`}
        style={{ fontSize: size === "xs" ? "8px" : size === "sm" ? "10px" : size === "md" ? "12px" : size === "lg" ? "14px" : "16px" }}
      >
        {symbol.charAt(0)}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative rounded-full overflow-hidden shadow-lg border-2 border-white/20`}>
      <Image
        src={iconUrl}
        alt={`${symbol} icon`}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}

// Component for displaying a pair of token icons
interface TokenPairIconProps {
  tokenA: string;
  tokenB: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function TokenPairIcon({ tokenA, tokenB, size = "md", className = "" }: TokenPairIconProps) {
  return (
    <div className={`flex -space-x-2 ${className}`}>
      <TokenIcon symbol={tokenA} size={size} />
      <TokenIcon symbol={tokenB} size={size} />
    </div>
  );
}
