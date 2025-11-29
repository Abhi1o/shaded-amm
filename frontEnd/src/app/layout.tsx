import type { Metadata } from 'next'
import { Source_Code_Pro, Chakra_Petch } from 'next/font/google'
import '../lib/polyfills' // Import polyfills first
import './globals.css'
import { Providers } from './providers'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NotificationContainer } from '../components/ui/NotificationContainer'
import { ResponsiveNav } from '../components/ui/ResponsiveNav'
import { SkipNav } from '../components/ui/SkipNav'
import { AccessibilityProvider } from '../components/ui/AccessibilityProvider'
import { AccessibilityMenu } from '../components/ui/AccessibilityMenu'
import { Toaster } from 'react-hot-toast'

// Primary font for the entire application
const sourceCodePro = Source_Code_Pro({ 
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
})

// Secondary font for number inputs
const chakraPetch = Chakra_Petch({ 
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-chakra-petch',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RocketSAMM - Sharded Liquidity Pools on EVM',
  description: 'A high-performance decentralized exchange with sharded liquidity pools on Monad and RiseChain. Swap tokens with optimal routing across multiple pool shards.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${sourceCodePro.className} ${sourceCodePro.variable} ${chakraPetch.variable}`}>
        <Providers>
          <ErrorBoundary>
            <AccessibilityProvider>
              <SkipNav />
              <div className="min-h-screen flex flex-col">
                <ResponsiveNav />
                <main id="main-content" className="flex-1" role="main">
                  {children}
                </main>
              </div>
              <NotificationContainer />
              <AccessibilityMenu />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'rgba(17, 24, 39, 0.95)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(12px)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </AccessibilityProvider>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}