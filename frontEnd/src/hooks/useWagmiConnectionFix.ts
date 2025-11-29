/**
 * Wagmi Connection Fix Hook
 * 
 * Fixes the issue where wagmi shows isConnected: false but has a wallet address
 * This happens when the wallet reconnects but wagmi doesn't update the state properly
 */

import { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function useWagmiConnectionFix() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    // If we have an address but wagmi thinks we're not connected, force reconnection
    if (address && !isConnected && connector) {
      console.log('🔧 Fixing wagmi connection state...');
      console.log('  - Address:', address);
      console.log('  - isConnected:', isConnected);
      console.log('  - Connector:', connector.name);
      
      // Disconnect and reconnect to fix the state
      const fixConnection = async () => {
        try {
          console.log('  - Disconnecting...');
          disconnect();
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('  - Reconnecting...');
          // Find the same connector and reconnect
          const sameConnector = connectors.find(c => c.id === connector.id);
          if (sameConnector) {
            await connect({ connector: sameConnector });
            console.log('  - ✅ Connection fixed!');
          }
        } catch (error) {
          console.error('  - ❌ Failed to fix connection:', error);
        }
      };

      fixConnection();
    }
  }, [address, isConnected, connector, connectors, connect, disconnect]);

  return { address, isConnected };
}
