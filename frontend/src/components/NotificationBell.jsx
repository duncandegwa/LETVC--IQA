import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/mine'),
    refetchInterval: 20000,
  });
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((o) => !o);
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/mark-all-read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* non-critical */ }
  }

  async function markOneRead(id) {
    try {
      await api.post(`/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* non-critical */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-graphite-100 hover:bg-white/10 focus-ring"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-clay-500 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-white rounded-xl shadow-xl border border-graphite-100 overflow-hidden z-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-graphite-100">
            <p className="font-display font-semibold text-graphite-900 text-sm">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-olive-600 font-medium hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!notifications?.length ? (
              <p className="text-sm text-graphite-400 px-4 py-6 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markOneRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-graphite-50 last:border-0 hover:bg-graphite-50 ${!n.isRead ? 'bg-olive-500/5' : ''}`}
                >
                  <p className="text-sm font-medium text-graphite-900">{n.title}</p>
                  <p className="text-xs text-graphite-500 mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-graphite-400 mt-1">{new Date(n.createdAt).toLocaleString('en-KE')}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
