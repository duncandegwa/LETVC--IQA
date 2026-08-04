import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../api/AuthContext';
import AuthedImage from './AuthedImage';

/**
 * A single thread per document, shared by the uploader and everyone who's
 * ever been assigned to review it — same access rule as preview/download
 * (see documentController.js::userCanAccessDocument). This is both the
 * "reply to a reviewer's comment" mechanism and general chat: a reply is
 * just the next message in the same thread.
 */
export default function DiscussionThread({ documentId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', documentId],
    queryFn: () => api.get(`/documents/${documentId}/messages`),
    refetchInterval: 8000, // lightweight polling — no websocket infrastructure in this scaffold
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/documents/${documentId}/messages`, { body: draft.trim() });
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['messages', documentId] });
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-graphite-100 p-6">
      <h2 className="font-display font-semibold text-graphite-900 mb-1">Discussion</h2>
      <p className="text-sm text-graphite-500 mb-4">
        Chat with your reviewers, or reply to a comment left on this document.
      </p>

      <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-1">
        {isLoading ? (
          <p className="text-graphite-300 text-sm">Loading…</p>
        ) : !messages?.length ? (
          <p className="text-graphite-400 text-sm">No messages yet — start the conversation below.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <AuthedImage
                  path={`/users/${m.senderId}/photo`}
                  alt={m.sender?.fullName}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  fallback={
                    <div className="w-7 h-7 rounded-full bg-olive-100 text-olive-700 flex items-center justify-center font-display font-semibold text-xs shrink-0 mt-0.5">
                      {m.sender?.fullName?.[0] || '?'}
                    </div>
                  }
                />
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <p className="text-xs text-graphite-400 mb-0.5">
                    {isMe ? 'You' : m.sender?.fullName} · {new Date(m.createdAt).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </p>
                  <div className={`rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-olive-500 text-white' : 'bg-graphite-50 text-graphite-800'}`}>
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        />
        <button
          disabled={sending || !draft.trim()}
          className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
