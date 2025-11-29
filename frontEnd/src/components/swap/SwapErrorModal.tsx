"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SwapErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string;
  title?: string;
}

export function SwapErrorModal({
  isOpen,
  onClose,
  error,
  title = "Swap Failed",
}: SwapErrorModalProps) {
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 blur-3xl rounded-3xl" />

              {/* Modal content */}
              <div className="relative backdrop-blur-xl bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden">
                {/* Error icon with animation */}
                <div className="relative pt-8 pb-6 px-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/50"
                  >
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                      className="w-12 h-12 text-white"
                      fill="none"
                      strokeWidth="3"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </motion.svg>
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400"
                  >
                    {title}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-2 text-center text-gray-400 text-sm"
                  >
                    Something went wrong with your transaction
                  </motion.p>
                </div>

                {/* Error details */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="px-6 pb-6"
                >
                  <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div className="flex-1">
                        <div className="text-sm text-red-300 font-medium mb-1">
                          Error Details
                        </div>
                        <div className="text-sm text-gray-300 leading-relaxed">
                          {error}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Common solutions */}
                  {error.toLowerCase().includes("insufficient") && (
                    <div className="mt-4 backdrop-blur-xl bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
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
                        <div className="flex-1">
                          <div className="text-sm text-blue-300 font-medium mb-2">
                            💡 Quick Fix
                          </div>
                          <div className="text-xs text-gray-300 space-y-1">
                            <div>• Get test tokens from the faucet</div>
                            <div>• Check your wallet balance</div>
                            <div>• Make sure you're on Devnet</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action button */}
                  <div className="mt-6">
                    <button
                      onClick={onClose}
                      className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      Try Again
                    </button>
                  </div>
                </motion.div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-500/20 to-transparent rounded-full blur-3xl" />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
