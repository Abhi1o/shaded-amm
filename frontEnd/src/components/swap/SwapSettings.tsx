'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  Cog6ToothIcon,
  InformationCircleIcon,
  ClockIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

export interface SwapSettingsData {
  slippageTolerance: number;
  deadline: number; // Minutes
  priorityFee: number; // Lamports
  maxAccounts: number;
  autoOptimizeFees: boolean;
}

interface SwapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SwapSettingsData;
  onSettingsChange: (settings: SwapSettingsData) => void;
}

export function SwapSettings({ isOpen, onClose, settings, onSettingsChange }: SwapSettingsProps) {
  const [localSettings, setLocalSettings] = useState<SwapSettingsData>(settings);
  const [customSlippage, setCustomSlippage] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');
  const [customPriorityFee, setCustomPriorityFee] = useState('');

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings: SwapSettingsData = {
      slippageTolerance: 0.5,
      deadline: 20,
      priorityFee: 0,
      maxAccounts: 64,
      autoOptimizeFees: true,
    };
    setLocalSettings(defaultSettings);
    setCustomSlippage('');
    setCustomDeadline('');
    setCustomPriorityFee('');
  };

  const handleSlippageChange = (value: number) => {
    setLocalSettings(prev => ({ ...prev, slippageTolerance: value }));
    setCustomSlippage('');
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      setLocalSettings(prev => ({ ...prev, slippageTolerance: numValue }));
    }
  };

  const handleDeadlineChange = (value: number) => {
    setLocalSettings(prev => ({ ...prev, deadline: value }));
    setCustomDeadline('');
  };

  const handleCustomDeadlineChange = (value: string) => {
    setCustomDeadline(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 1440) { // Max 24 hours
      setLocalSettings(prev => ({ ...prev, deadline: numValue }));
    }
  };

  const handlePriorityFeeChange = (value: string) => {
    setCustomPriorityFee(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setLocalSettings(prev => ({ ...prev, priorityFee: numValue }));
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  Swap Settings
                </Dialog.Title>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Slippage Tolerance */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <label className="text-sm font-medium text-gray-900">Slippage Tolerance</label>
                  <div className="group relative">
                    <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Maximum price movement tolerance
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  {[0.1, 0.5, 1.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleSlippageChange(value)}
                      className={`px-3 py-1 text-sm rounded-lg ${
                        localSettings.slippageTolerance === value && !customSlippage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(e) => handleCustomSlippageChange(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {localSettings.slippageTolerance > 5 && (
                  <p className="text-xs text-yellow-600">High slippage tolerance may result in unfavorable trades</p>
                )}
              </div>

              {/* Transaction Deadline */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <ClockIcon className="w-4 h-4 text-gray-600" />
                  <label className="text-sm font-medium text-gray-900">Transaction Deadline</label>
                  <div className="group relative">
                    <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Transaction will fail if not confirmed within this time
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  {[10, 20, 30].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleDeadlineChange(value)}
                      className={`px-3 py-1 text-sm rounded-lg ${
                        localSettings.deadline === value && !customDeadline
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {value}m
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Custom"
                    value={customDeadline}
                    onChange={(e) => handleCustomDeadlineChange(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Priority Fee */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <BoltIcon className="w-4 h-4 text-gray-600" />
                  <label className="text-sm font-medium text-gray-900">Priority Fee (Lamports)</label>
                  <div className="group relative">
                    <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Additional fee to prioritize your transaction
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="0"
                  value={customPriorityFee}
                  onChange={(e) => handlePriorityFeeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher fees increase transaction priority. 0 = auto-optimize
                </p>
              </div>

              {/* Auto-optimize Fees */}
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.autoOptimizeFees}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoOptimizeFees: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Auto-optimize Fees</div>
                    <div className="text-xs text-gray-500">Automatically adjust compute unit prices based on network conditions</div>
                  </div>
                </label>
              </div>

              {/* Max Accounts */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">Max Accounts for Multi-hop</label>
                <select
                  value={localSettings.maxAccounts}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, maxAccounts: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={32}>32 (Faster)</option>
                  <option value={64}>64 (Balanced)</option>
                  <option value={128}>128 (More routes)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Higher values allow more complex routes but may be slower
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-8">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reset to Default
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Settings
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}