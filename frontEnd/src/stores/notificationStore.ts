import { create } from 'zustand';
import { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Convenience methods for common notification types
  showSuccess: (title: string, message: string, autoClose?: boolean) => void;
  showError: (title: string, message: string, autoClose?: boolean) => void;
  showWarning: (title: string, message: string, autoClose?: boolean) => void;
  showInfo: (title: string, message: string, autoClose?: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const timestamp = Date.now();
    
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp,
      autoClose: notification.autoClose ?? true,
      duration: notification.duration ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove notification if autoClose is enabled
    if (newNotification.autoClose && newNotification.duration) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, newNotification.duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  showSuccess: (title, message, autoClose = true) => {
    set((state) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type: 'success',
        title,
        message,
        timestamp: Date.now(),
        autoClose,
        duration: 5000,
      };

      if (autoClose) {
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        }, 5000);
      }

      return {
        notifications: [...state.notifications, notification],
      };
    });
  },

  showError: (title, message, autoClose = false) => {
    set((state) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type: 'error',
        title,
        message,
        timestamp: Date.now(),
        autoClose,
        duration: autoClose ? 8000 : undefined,
      };

      if (autoClose) {
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        }, 8000);
      }

      return {
        notifications: [...state.notifications, notification],
      };
    });
  },

  showWarning: (title, message, autoClose = true) => {
    set((state) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type: 'warning',
        title,
        message,
        timestamp: Date.now(),
        autoClose,
        duration: 6000,
      };

      if (autoClose) {
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        }, 6000);
      }

      return {
        notifications: [...state.notifications, notification],
      };
    });
  },

  showInfo: (title, message, autoClose = true) => {
    set((state) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type: 'info',
        title,
        message,
        timestamp: Date.now(),
        autoClose,
        duration: 5000,
      };

      if (autoClose) {
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        }, 5000);
      }

      return {
        notifications: [...state.notifications, notification],
      };
    });
  },
}));
