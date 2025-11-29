'use client';

import React from 'react';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from './LoadingSpinner';

export type TransactionStep = {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string;
};

interface TransactionProgressProps {
  steps: TransactionStep[];
  currentStep?: string;
}

const StepIcon = ({ status }: { status: TransactionStep['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
    case 'failed':
      return <XCircleIcon className="w-6 h-6 text-red-500" />;
    case 'in_progress':
      return <LoadingSpinner size="sm" />;
    case 'pending':
      return <ClockIcon className="w-6 h-6 text-gray-400" />;
  }
};

export function TransactionProgress({ steps, currentStep }: TransactionProgressProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = step.id === currentStep;

        return (
          <div key={step.id} className="relative">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 relative">
                <StepIcon status={step.status} />
                
                {!isLast && (
                  <div
                    className={`absolute top-8 left-3 w-0.5 h-8 ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {step.label}
                </p>
                
                {step.description && (
                  <p className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </p>
                )}

                {step.status === 'in_progress' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                      <div className="bg-blue-600 h-1 rounded-full animate-progress" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
