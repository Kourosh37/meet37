import { createContext, useContext } from 'react';

export type NotifyApi = {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
};

export const NotificationContext = createContext<NotifyApi | null>(null);

export function useNotify(): NotifyApi {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotify must be used inside NotificationsProvider');
  }
  return context;
}

