import { http, createConfig } from 'wagmi';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { MONAD_TESTNET } from './evm-networks';

// Define chains for wagmi - Monad only
const monadTestnet = {
  id: MONAD_TESTNET.chainId,
  name: MONAD_TESTNET.name,
  nativeCurrency: MONAD_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: MONAD_TESTNET.rpcUrls },
    public: { http: MONAD_TESTNET.rpcUrls },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: MONAD_TESTNET.blockExplorerUrls[0]
    },
  },
  testnet: true,
};

// WalletConnect project ID - get from https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Create connectors array conditionally to avoid SSR issues
const getConnectors = () => {
  const connectors: any[] = [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'RocketSAMM DEX' }),
  ];

  // Only add WalletConnect if we have a valid project ID and we're in the browser
  if (typeof window !== 'undefined' && projectId && projectId !== 'YOUR_PROJECT_ID') {
    connectors.push(
      walletConnect({ 
        projectId,
        showQrModal: true,
      }) as any
    );
  }

  return connectors;
};

export const config = createConfig({
  chains: [monadTestnet] as const,
  connectors: getConnectors(),
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true, // Enable SSR support
  multiInjectedProviderDiscovery: false, // Disable to prevent conflicts
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
