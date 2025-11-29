'use client';

import React from 'react';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { useChainId, useSwitchChain } from 'wagmi';
import { NETWORK_LIST, getNetworkByChainId } from '../config/evm-networks';

export const NetworkSwitcher: React.FC = () => {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const currentNetwork = getNetworkByChainId(chainId) || NETWORK_LIST[0];

  const handleNetworkChange = (newChainId: number) => {
    if (newChainId !== chainId && !isPending) {
      switchChain({ chainId: newChainId });
    }
  };

  return (
    <div className="w-72">
      <Listbox value={chainId} onChange={handleNetworkChange} disabled={isPending}>
        <div className="relative mt-1">
          <ListboxButton className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
            <div className="flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: currentNetwork.color }}
              />
              <span className="block truncate font-medium">{currentNetwork.displayName}</span>
              {isPending && (
                <div className="ml-2 w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
              )}
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </ListboxButton>
          
          <ListboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-10">
            {NETWORK_LIST.map((network) => (
              <ListboxOption
                key={network.chainId}
                value={network.chainId}
                className={({ focus }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    focus ? 'bg-amber-100 text-amber-900' : 'text-gray-900'
                  }`
                }
              >
                {({ selected }) => (
                  <>
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: network.color }}
                      />
                      <div>
                        <span
                          className={`block truncate ${
                            selected ? 'font-medium' : 'font-normal'
                          }`}
                        >
                          {network.displayName}
                        </span>
                        <span className="text-xs text-gray-500">
                          Chain ID: {network.chainId}
                        </span>
                      </div>
                    </div>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  );
};
