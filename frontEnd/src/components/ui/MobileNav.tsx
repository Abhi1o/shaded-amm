'use client';

import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  Bars3Icon,
  HomeIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  ClockIcon,
  UserCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WalletConnectButton } from '../wallet/WalletConnectButton';

const navigation = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Swap', href: '/swap', icon: ArrowsRightLeftIcon },
  { name: 'Pools', href: '/pools', icon: BeakerIcon },
  { name: 'Liquidity', href: '/liquidity', icon: CurrencyDollarIcon },
  { name: 'Account', href: '/account', icon: UserCircleIcon },
  { name: 'Transactions', href: '/transactions', icon: ClockIcon },
];

export function MobileNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden inline-flex items-center justify-center p-2 rounded-2xl text-gray-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all"
        onClick={() => setMobileMenuOpen(true)}
      >
        <span className="sr-only">Open main menu</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Mobile menu dialog */}
      <Transition.Root show={mobileMenuOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setMobileMenuOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>

                {/* Sidebar content */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto backdrop-blur-xl bg-black/95 px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center gap-3">
                    <Image
                      src="/logo.png"
                      alt="Rocket Logo"
                      width={32}
                      height={32}
                    />
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                      Rocket Sharded Amm
                    </h1>
                  </div>
                  
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-2">
                          {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                              <li key={item.name}>
                                <Link
                                  href={item.href}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`
                                    group flex gap-x-3 rounded-2xl p-3 text-sm leading-6 font-semibold transition-all
                                    ${isActive
                                      ? 'backdrop-blur-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/50 text-white'
                                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                                    }
                                  `}
                                >
                                  <item.icon
                                    className={`h-5 w-5 shrink-0 ${
                                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                      
                      <li className="mt-auto">
                        <div className="border-t border-white/10 pt-4">
                          <WalletConnectButton 
                            className="w-full justify-center"
                            showBalance={true}
                            showNetwork={true}
                          />
                        </div>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}
