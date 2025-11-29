'use client';

import React from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useNotificationStore } from '@/stores/notificationStore';
import { Notification } from '@/types';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'success':
      return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
    case 'error':
      return <XCircleIcon className="w-6 h-6 text-red-500" />;
    case 'warning':
      return <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />;
    case 'info':
      return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
  }
};

const NotificationItem = ({ notification }: { notification: Notification }) => {
  const { removeNotification } = useNotificationStore();

  const bgColorClass = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }[notification.type];

  const textColorClass = {
    success: 'text-green-900',
    error: 'text-red-900',
    warning: 'text-yellow-900',
    info: 'text-blue-900',
  }[notification.type];

  return (
    <div
      className={`${bgColorClass} border rounded-lg shadow-lg p-4 max-w-sm w-full animate-slide-in-right`}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <NotificationIcon type={notification.type} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${textColorClass}`}>
            {notification.title}
          </p>
          <p className={`text-sm mt-1 ${textColorClass} opacity-90`}>
            {notification.message}
          </p>
          
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`text-sm font-medium mt-2 underline ${textColorClass} hover:opacity-80`}
            >
              {notification.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => removeNotification(notification.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close notification"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export function NotificationContainer() {
  const { notifications } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-3 pointer-events-auto">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </div>
    </div>
  );
}
