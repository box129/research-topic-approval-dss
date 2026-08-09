import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../api/notifications';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message
    || error?.response?.data?.message
    || fallback;
}

function formatNotificationTime(value) {
  if (!value) {
    return 'Time unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getNotificationKey(item) {
  return item?.id ?? `${item?.type || 'notification'}-${item?.createdAt || item?.title || 'unknown'}`;
}

function NotificationCenter() {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');

  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await listNotifications({ limit: 10 });
      setItems(result.data?.items || []);
      setUnreadCount(result.meta?.unreadCount || 0);
    } catch (loadError) {
      setItems([]);
      setUnreadCount(0);
      setError(getErrorMessage(loadError, 'Unable to load notifications.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialNotifications() {
      setIsLoading(true);
      setError('');

      try {
        const result = await listNotifications({ limit: 10 });
        if (!active) {
          return;
        }

        setItems(result.data?.items || []);
        setUnreadCount(result.meta?.unreadCount || 0);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setItems([]);
        setUnreadCount(0);
        setError(getErrorMessage(loadError, 'Unable to load notifications.'));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadInitialNotifications();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    panelRef.current?.querySelector('[data-notification-close]')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((current) => !current);
  };

  const handleMarkRead = async (item) => {
    if (!item?.id || item.readAt) {
      return;
    }

    setIsMutating(true);
    setError('');

    try {
      const result = await markNotificationRead(item.id);
      const updatedItem = result.data?.item;
      setItems((currentItems) => currentItems.map((currentItem) => (
        currentItem.id === item.id
          ? { ...currentItem, ...(updatedItem || {}), readAt: updatedItem?.readAt || new Date().toISOString() }
          : currentItem
      )));
      setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark notification as read.'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    setIsMutating(true);
    setError('');

    try {
      const result = await markAllNotificationsRead();
      const readAt = result.data?.readAt || new Date().toISOString();
      setItems((currentItems) => currentItems.map((item) => ({
        ...item,
        readAt: item.readAt || readAt
      })));
      setUnreadCount(0);
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark all notifications as read.'));
    } finally {
      setIsMutating(false);
    }
  };

  const panelStatus = useMemo(() => {
    if (isLoading) {
      return 'loading';
    }

    if (error) {
      return 'error';
    }

    if (items.length === 0) {
      return 'empty';
    }

    return 'ready';
  }, [error, isLoading, items.length]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Open notifications"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-emerald-50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM8.05 16a2 2 0 0 0 3.9 0h-3.9Z" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadLabel} unread notifications`}
            className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[0.65rem] font-black text-emerald-950 shadow"
          >
            {unreadLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[10px] border border-emerald-900/10 bg-white text-gray-900 shadow-modal"
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-gray-950">Notifications</h2>
              <p className="text-xs font-medium text-gray-500">
                {unreadCount === 0 ? 'No unread notifications' : `${unreadCount} unread`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMutating || unreadCount === 0}
                className="rounded-md px-2 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Mark all read
              </button>
              <button
                data-notification-close
                type="button"
                aria-label="Close notifications"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="min-h-10 rounded-md px-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-3">
            {panelStatus === 'loading' && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-5 text-sm font-semibold text-emerald-800">
                Loading notifications...
              </div>
            )}

            {panelStatus === 'error' && (
              <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-4">
                <p className="text-sm font-bold text-red-800">{error}</p>
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800"
                >
                  Retry
                </button>
              </div>
            )}

            {panelStatus === 'empty' && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                No notifications yet.
              </div>
            )}

            {panelStatus === 'ready' && (
              <ul className="space-y-2">
                {items.map((item) => {
                  const isUnread = !item.readAt;

                  return (
                    <li
                      key={getNotificationKey(item)}
                      className={[
                        'rounded-lg border px-3 py-3 text-left shadow-sm',
                        isUnread
                          ? 'border-emerald-100 bg-emerald-50/70'
                          : 'border-gray-100 bg-white'
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-950">{item.title}</p>
                          <p className="mt-1 text-sm leading-5 text-gray-600">{item.message}</p>
                          <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-gray-400">
                            {item.type || 'Notification'} - {formatNotificationTime(item.createdAt)}
                          </p>
                        </div>
                        {isUnread && (
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" aria-label="Unread" />
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.linkPath && (
                          <Link
                            to={item.linkPath}
                            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                          >
                            Open
                          </Link>
                        )}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(item)}
                            disabled={isMutating}
                            className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-400"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default NotificationCenter;
