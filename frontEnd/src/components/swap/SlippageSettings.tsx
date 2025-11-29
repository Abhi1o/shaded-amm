"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SlippageSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentSlippage: number;
  onSlippageChange: (slippage: number) => void;
}

export function SlippageSettings({
  isOpen,
  onClose,
  currentSlippage,
  onSlippageChange,
}: SlippageSettingsProps) {
  const [customSlippage, setCustomSlippage] = useState(currentSlippage.toString());
  const presetSlippages = [0.1, 0.5, 1.0, 3.0, 5.0];

  const handlePresetClick = (slippage: number) => {
    onSlippageChange(slippage);
    setCustomSlippage(slippage.toString());
  };

  const handleCustomChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      onSlippageChange(numValue);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md"
            >
              <div className="backdrop-blur-xl bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 border border-white/10 rounded-3xl shadow-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Slippage Settings</h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-4">
                  Slippage tolerance is the maximum price change you're willing to accept for your swap.
                </p>

                {/* Preset Slippages */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Preset Values
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {presetSlippages.map((slippage) => (
                      <button
                        key={slippage}
                        onClick={() => handlePresetClick(slippage)}
                        className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          currentSlippage === slippage
                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                            : "bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {slippage}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Slippage */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Custom Slippage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={customSlippage}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="0.50"
                      step="0.1"
                      min="0.1"
                      max="50"
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      %
                    </span>
                  </div>
                  {parseFloat(customSlippage) > 5 && (
                    <p className="mt-2 text-xs text-yellow-400">
                      ⚠️ High slippage tolerance may result in unfavorable rates
                    </p>
                  )}
                </div>

                {/* Info Box */}
                <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-xs text-blue-300">
                      <div className="font-semibold mb-1">Current Setting: {currentSlippage}%</div>
                      <div>
                        {currentSlippage < 0.5 && "Very low - transactions may fail"}
                        {currentSlippage >= 0.5 && currentSlippage <= 1 && "Recommended for most swaps"}
                        {currentSlippage > 1 && currentSlippage <= 3 && "Higher tolerance - good for volatile pairs"}
                        {currentSlippage > 3 && "Very high - use with caution"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
