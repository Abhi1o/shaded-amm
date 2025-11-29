import { useSwapStore } from '@/stores/swapStore';

export const useSwap = () => {
  const swapStore = useSwapStore();
  
  return {
    ...swapStore,
  };
};