import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../api/AuthContext';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // changePassword() re-authenticates with currentPassword only if
      // Firebase requires it (session not "recent" enough) — see AuthContext.
      await changePassword(currentPassword, newPassword);
      navigate('/trainer');
    } catch (err) {
      setError(err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-xl p-8 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-graphite-900 mb-2">Set a new password</h2>
        <p className="text-sm text-graphite-500 mb-6">You must change your temporary password before continuing.</p>
        {error && <div className="mb-4 px-3 py-2 rounded-md bg-clay-500/10 text-clay-600 text-sm">{error}</div>}
        <label className="block text-sm font-medium text-graphite-700 mb-1.5">Current (temporary) password</label>
        <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2.5 border border-graphite-100 rounded-md focus-ring" />
        <label className="block text-sm font-medium text-graphite-700 mb-1.5">New password</label>
        <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full mb-6 px-3 py-2.5 border border-graphite-100 rounded-md focus-ring" />
        <button disabled={submitting} className="w-full py-2.5 rounded-md bg-olive-500 text-white font-medium hover:bg-olive-600 focus-ring disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
