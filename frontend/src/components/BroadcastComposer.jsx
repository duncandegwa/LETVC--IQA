import { useState } from 'react';
import { api } from '../api/client';

const AUDIENCES = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'HOD', label: 'All HODs' },
  { value: 'IQA', label: 'All IQA Officers' },
  { value: 'DP', label: 'All DP Academics' },
];

/** Lets the Administrator or DP Academics send an announcement to a chosen audience. */
export default function BroadcastComposer() {
  const [form, setForm] = useState({ audience: 'ALL', title: '', message: '' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/notifications/broadcast', form);
      setResult({ type: 'success', message: `Sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? '' : 's'}.` });
      setForm({ audience: 'ALL', title: '', message: '' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-graphite-100 p-6 max-w-xl">
      <h3 className="font-display font-semibold text-graphite-900 mb-1">Send a notification</h3>
      <p className="text-sm text-graphite-500 mb-4">
        Reaches every account in the chosen audience, in their notification bell and by email.
      </p>

      {result && (
        <div className={`mb-4 px-3 py-2 rounded-md text-sm ${result.type === 'error' ? 'bg-clay-500/10 text-clay-600' : 'bg-olive-500/10 text-olive-700'}`}>
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">Audience</label>
          <select
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          >
            {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
            placeholder="e.g. Deadline reminder"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">Message</label>
          <textarea
            required
            rows={4}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring resize-none"
          />
        </div>
        <button
          disabled={sending}
          className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send notification'}
        </button>
      </form>
    </div>
  );
}
