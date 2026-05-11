import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { NotificationContext, type NotifyApi } from './notificationsContext';

type NoticeKind = 'error' | 'success' | 'info';

type Notice = {
  id: string;
  kind: NoticeKind;
  message: string;
};

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const push = useCallback((kind: NoticeKind, message: string) => {
    const id = crypto.randomUUID();
    setNotices((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 3200);
  }, []);

  const api = useMemo<NotifyApi>(
    () => ({
      error: (message) => push('error', message),
      success: (message) => push('success', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
        <div className="grid w-full max-w-xl gap-2">
          {notices.map((notice) => (
            <div key={notice.id} className={`toast toast-${notice.kind}`}>
              {notice.message}
            </div>
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}
