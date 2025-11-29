"use client";

import React, { useState } from "react";
import { Token } from "@/types";

interface TokenLogoProps {
  token: Token;
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

export function TokenLogo({
  token,
  size = "md",
  className = "",
}: TokenLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sizeClass = sizeClasses[size];

  // Fallback to a default token icon or generate one based on symbol
  const generateFallbackIcon = (symbol: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-yellow-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-gray-500",
    ];

    // Use symbol to consistently pick a color
    const colorIndex =
      symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    const bgColor = colors[colorIndex];

    return (
      <div
        className={`${sizeClass} ${bgColor} rounded-full flex items-center justify-center text-white font-bold ${className}`}
      >
        <span
          className={`${
            size === "xs" ? "text-xs" : size === "sm" ? "text-xs" : "text-sm"
          }`}
        >
          {symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  };

  // Handle image load success
  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  // Handle image load error
  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  // Show fallback if no logoURI, image failed to load, or still loading
  if (!token.logoURI || imageError) {
    return generateFallbackIcon(token.symbol);
  }

  return (
    <div className={`${sizeClass} ${className} relative`}>
      {isLoading && (
        <div
          className={`${sizeClass} bg-gray-200 rounded-full animate-pulse`}
        />
      )}
      <img
        src={token.logoURI}
        alt={`${token.symbol} logo`}
        className={`${sizeClass} rounded-full object-cover ${
          isLoading ? "opacity-0" : "opacity-100"
        } transition-opacity`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
}
