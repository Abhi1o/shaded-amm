'use client';

import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  XMarkIcon, 
  AdjustmentsHorizontalIcon,
  EyeIcon,
  BoltIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useAccessibility } from './AccessibilityProvider';

export function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, toggleHighContrast, toggleReducedMotion, setFontSize } = useAccessibility();

  return (
    <>
      {/* Accessibility Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation"
        aria-label="Open accessibility settings"
        title="Accessibility Settings"
      >
        <AdjustmentsHorizontalIcon className="w-6 h-6" />
      </button>

      {/* Accessibility Settings Dialog */}
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                      Accessibility Settings
                    </Dialog.Title>

                    <div className="space-y-6">
                      {/* High Contrast Mode */}
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <EyeIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="high-contrast" className="text-sm font-medium text-gray-900">
                                High Contrast Mode
                              </label>
                              <p className="text-sm text-gray-500">
                                Increase contrast for better visibility
                              </p>
                            </div>
                            <button
                              id="high-contrast"
                              type="button"
                              role="switch"
                              aria-checked={settings.highContrast}
                              onClick={toggleHighContrast}
                              className={`${
                                settings.highContrast ? 'bg-blue-600' : 'bg-gray-200'
                              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  settings.highContrast ? 'translate-x-5' : 'translate-x-0'
                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Reduced Motion */}
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <BoltIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="reduced-motion" className="text-sm font-medium text-gray-900">
                                Reduced Motion
                              </label>
                              <p className="text-sm text-gray-500">
                                Minimize animations and transitions
                              </p>
                            </div>
                            <button
                              id="reduced-motion"
                              type="button"
                              role="switch"
                              aria-checked={settings.reducedMotion}
                              onClick={toggleReducedMotion}
                              className={`${
                                settings.reducedMotion ? 'bg-blue-600' : 'bg-gray-200'
                              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Font Size */}
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <DocumentTextIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3 flex-1">
                          <label className="text-sm font-medium text-gray-900 block mb-2">
                            Font Size
                          </label>
                          <div className="flex gap-2">
                            {(['normal', 'large', 'xlarge'] as const).map((size) => (
                              <button
                                key={size}
                                onClick={() => setFontSize(size)}
                                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border ${
                                  settings.fontSize === size
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                              >
                                {size === 'normal' ? 'Normal' : size === 'large' ? 'Large' : 'X-Large'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Keyboard Shortcuts Info */}
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Keyboard Shortcuts</h4>
                        <dl className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <dt>Navigate:</dt>
                            <dd className="font-mono">Tab / Shift+Tab</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Activate:</dt>
                            <dd className="font-mono">Enter / Space</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Close dialogs:</dt>
                            <dd className="font-mono">Escape</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={() => setIsOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}
