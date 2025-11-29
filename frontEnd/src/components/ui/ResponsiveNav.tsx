'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  ClockIcon,
  UserCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { WalletConnectButton } from '../wallet/WalletConnectButton';
import { ChainSelector } from '../wallet/ChainSelector';
import { useMultiChain } from '@/providers/MultiChainProvider';
import { MobileNav } from './MobileNav';
import { ChainBadge } from './ChainIndicator';
import { motion } from 'framer-motion';

const navigation = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Swap', href: '/swap', icon: ArrowsRightLeftIcon },
  { name: 'Pools', href: '/pools', icon: BeakerIcon },
  { name: 'Liquidity', href: '/liquidity', icon: CurrencyDollarIcon },
  { name: 'Account', href: '/account', icon: UserCircleIcon },
  { name: 'Transactions', href: '/transactions', icon: ClockIcon },
];

export function ResponsiveNav() {
  const pathname = usePathname();
  const { currentChainId, switchToEVM, isSwitching } = useMultiChain();

  return (
    <nav 
      className="sticky top-0 z-50 backdrop-blur-xl bg-black/95 border-b border-white/5"
      role="navigation" 
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              aria-label="Rocket Sharded Amm Home"
            >
              <Image
                src="/logo.png"
                alt="Rocket Logo"
                width={28}
                height={28}
                className="group-hover:scale-110 transition-transform duration-200"
              />
              <span className="text-base font-bold text-white tracking-tight">
                Rocket Sharded Amm
              </span>
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-1" role="menubar">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors duration-200
                    ${isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Desktop wallet section */}
          <div className="hidden lg:flex lg:items-center lg:gap-3">
            {/* Wallet Connect Button */}
            <WalletConnectButton
              showBalance={false}
              showNetwork={false}
            />
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </nav>
  );
}
