import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';
import { api } from './client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // Postgres user row
  const [capabilities, setCapabilities] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setProfile(data.user);
      setCapabilities(data.capabilities);
      setMustChangePassword(data.mustChangePassword);
      setError(null);
    } catch (err) {
      // Most likely NO_PROFILE — Firebase knows this person but the
      // Administrator hasn't created their profile/role in Postgres yet.
      setProfile(null);
      setCapabilities(null);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    // Firebase restores the session from its own local persistence on
    // reload and fires this automatically — no manual "refresh" call needed,
    // unlike the old cookie-based flow.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile();
      } else {
        setProfile(null);
        setCapabilities(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadProfile]);

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
    await loadProfile();
  }

  async function logout() {
    await firebaseSignOut(auth);
    setProfile(null);
    setCapabilities(null);
  }

  async function requestPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Changing a password is a "sensitive" Firebase operation that requires a
   * recently-issued token — if the person's session isn't fresh enough,
   * Firebase throws auth/requires-recent-login. We handle that transparently
   * by re-authenticating with their current password first, so this still
   * works as a single form submission from the UI's point of view.
   */
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    try {
      await updatePassword(user, newPassword);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
      } else {
        throw err;
      }
    }
    await api.post('/auth/complete-password-change');
    setMustChangePassword(false);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user: profile,
        capabilities,
        mustChangePassword,
        loading,
        error,
        login,
        logout,
        requestPasswordReset,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
