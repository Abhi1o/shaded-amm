'use client';

import { useState, useCallback } from 'react';
import { TransactionStep } from '@/components/ui/TransactionProgress';

interface UseTransactionProgressReturn {
  steps: TransactionStep[];
  currentStep: string | null;
  initializeSteps: (stepDefinitions: Omit<TransactionStep, 'status'>[]) => void;
  startStep: (stepId: string, description?: string) => void;
  completeStep: (stepId: string) => void;
  failStep: (stepId: string, description?: string) => void;
  resetProgress: () => void;
  isComplete: boolean;
  hasFailed: boolean;
}

export function useTransactionProgress(): UseTransactionProgressReturn {
  const [steps, setSteps] = useState<TransactionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  const initializeSteps = useCallback(
    (stepDefinitions: Omit<TransactionStep, 'status'>[]) => {
      const initialSteps = stepDefinitions.map((step) => ({
        ...step,
        status: 'pending' as const,
      }));
      setSteps(initialSteps);
      setCurrentStep(null);
    },
    []
  );

  const startStep = useCallback((stepId: string, description?: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status: 'in_progress' as const,
              description: description || step.description,
            }
          : step
      )
    );
    setCurrentStep(stepId);
  }, []);

  const completeStep = useCallback((stepId: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId
          ? { ...step, status: 'completed' as const }
          : step
      )
    );
    
    // Move to next step if available
    setSteps((prevSteps) => {
      const currentIndex = prevSteps.findIndex((s) => s.id === stepId);
      const nextStep = prevSteps[currentIndex + 1];
      
      if (nextStep && nextStep.status === 'pending') {
        setCurrentStep(nextStep.id);
      } else {
        setCurrentStep(null);
      }
      
      return prevSteps;
    });
  }, []);

  const failStep = useCallback((stepId: string, description?: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status: 'failed' as const,
              description: description || step.description,
            }
          : step
      )
    );
    setCurrentStep(null);
  }, []);

  const resetProgress = useCallback(() => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
      }))
    );
    setCurrentStep(null);
  }, []);

  const isComplete = steps.length > 0 && steps.every((step) => step.status === 'completed');
  const hasFailed = steps.some((step) => step.status === 'failed');

  return {
    steps,
    currentStep,
    initializeSteps,
    startStep,
    completeStep,
    failStep,
    resetProgress,
    isComplete,
    hasFailed,
  };
}
