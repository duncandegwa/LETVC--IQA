import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../api/AuthContext';

function friendlyError(err) {
  // Firebase's default messages are fine but verbose/inconsistent in tone;
  // normalize the common ones so the login form reads cleanly.
  if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
    return 'Incorrect email or password.';
  }
  if (err.code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return err.message;
}

export default function Login() {
  const { login, mustChangePassword, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(mustChangePassword ? '/change-password' : '/trainer');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?".');
      return;
    }
    setError('');
    try {
      await requestPasswordReset(email);
      setNotice(`If ${email} has an account, a reset link has been sent.`);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Laikipia East TVC" className="w-20 h-20 mx-auto rounded-full bg-white p-1 shadow-lg" />
          <h1 className="font-display text-2xl font-semibold text-white mt-4">Laikipia East TVC</h1>
          <p className="text-graphite-300 text-sm mt-1">Internal Quality Assurance Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8 shadow-xl">
          <h2 className="font-display text-lg font-semibold text-graphite-900 mb-6">Sign in</h2>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-md bg-clay-500/10 text-clay-600 text-sm">{error}</div>
          )}
          {notice && (
            <div className="mb-4 px-3 py-2 rounded-md bg-olive-500/10 text-olive-700 text-sm">{notice}</div>
          )}

          <label className="block text-sm font-medium text-graphite-700 mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 px-3 py-2.5 border border-graphite-100 rounded-md focus-ring focus:border-olive-500"
            placeholder="you@laikipiaeasttvc.ac.ke"
          />

          <label className="block text-sm font-medium text-graphite-700 mb-1.5" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-2 px-3 py-2.5 border border-graphite-100 rounded-md focus-ring focus:border-olive-500"
          />
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-olive-600 hover:underline"
          >
            Forgot password?
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 py-2.5 rounded-md bg-olive-500 text-white font-medium hover:bg-olive-600 transition-colors focus-ring disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
