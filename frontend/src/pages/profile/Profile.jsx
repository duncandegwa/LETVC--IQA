import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../api/AuthContext';
import AuthedImage from '../../components/AuthedImage';

function Avatar({ userId, name }) {
  return (
    <AuthedImage
      path={`/users/${userId}/photo`}
      alt={name}
      className="w-20 h-20 rounded-full object-cover bg-graphite-100"
      fallback={
        <div className="w-20 h-20 rounded-full bg-olive-100 text-olive-700 flex items-center justify-center font-display font-semibold text-2xl">
          {name?.[0] || '?'}
        </div>
      }
    />
  );
}

function RoleList({ deptAssignments, systemRole }) {
  if (systemRole === 'ADMIN') return <p className="text-sm text-graphite-500">Administrator</p>;
  if (!deptAssignments?.length) return <p className="text-sm text-graphite-500">Trainer</p>;
  return (
    <ul className="text-sm text-graphite-600 space-y-1">
      <li>Trainer</li>
      {deptAssignments.map((a) => (
        <li key={a.id}>
          {a.role.replace('_', ' ')}{a.isActing ? ' (acting)' : ''} — {a.department?.name}
        </li>
      ))}
    </ul>
  );
}

/** Upload widget shared by the Signature and Stamp sections — PNG only, per spec. */
function AssetUpload({ label, kind, currentAsset, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await api.post(`/users/me/${kind}`, body, { isForm: true });
      onUploaded();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="border border-graphite-100 rounded-lg p-4">
      <p className="text-sm font-medium text-graphite-900 mb-2">{label}</p>
      <div className="flex items-center gap-4">
        <div className="w-28 h-16 border border-dashed border-graphite-100 rounded-md flex items-center justify-center bg-graphite-50 overflow-hidden">
          {currentAsset ? (
            <AuthedImage
              path={`/users/signature-assets/${currentAsset.id}/file`}
              alt={label}
              className="max-w-full max-h-full object-contain"
              fallback={<span className="text-xs text-graphite-300">No preview</span>}
            />
          ) : (
            <span className="text-xs text-graphite-300">Not set</span>
          )}
        </div>
        <label className="text-sm text-olive-600 font-medium hover:underline cursor-pointer focus-ring">
          {uploading ? 'Uploading…' : currentAsset ? 'Replace' : 'Upload PNG'}
          <input type="file" accept="image/png" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <p className="text-xs text-graphite-400 mt-2">
        Transparent PNG only. Embedded automatically on documents you upload or approve.
      </p>
    </div>
  );
}

/** Self-service password change, usable any time — separate from the forced first-login flow in pages/auth/ChangePassword.jsx. */
function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState(null); // { type: 'error' | 'success', message }
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (form.newPassword.length < 8) {
      return setStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
    }
    if (form.newPassword !== form.confirmPassword) {
      return setStatus({ type: 'error', message: 'New password and confirmation do not match.' });
    }
    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus({ type: 'success', message: 'Password updated.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-graphite-100 p-6 mb-6">
      <h2 className="font-display font-semibold text-graphite-900 mb-1">Password</h2>
      <p className="text-sm text-graphite-500 mb-4">Change your password at any time.</p>
      {status && (
        <div className={`mb-4 px-3 py-2 rounded-md text-sm ${status.type === 'error' ? 'bg-clay-500/10 text-clay-600' : 'bg-olive-500/10 text-olive-700'}`}>
          {status.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">Current password</label>
          <input type="password" required value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">New password</label>
          <input type="password" required minLength={8} value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-graphite-700 mb-1">Confirm new password</label>
          <input type="password" required minLength={8} value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
        </div>
        <button disabled={saving} className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60">
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams(); // present when viewing a colleague's profile
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const viewingSelf = !id || id === me?.id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id || 'me'],
    queryFn: () => api.get(viewingSelf ? '/users/me' : `/users/${id}`),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', designation: '' });
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  function startEditing() {
    setForm({ phone: profile.phone || '', designation: profile.designation || '' });
    setEditing(true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', form);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const body = new FormData();
      body.append('photo', file);
      await api.post('/users/me/photo', body, { isForm: true });
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    } catch (err) {
      alert(err.message);
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  }

  if (isLoading) return <p className="text-graphite-300 text-sm">Loading…</p>;
  if (!profile) return null;

  const canReview = profile.capabilities && (
    profile.capabilities.hod?.length || profile.capabilities.hodActing?.length ||
    profile.capabilities.iqa?.length || profile.capabilities.iqaActing?.length ||
    profile.capabilities.dp?.length || profile.capabilities.dpActing?.length
  );

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-graphite-900 mb-1">
        {viewingSelf ? 'My Profile' : profile.fullName}
      </h1>
      <p className="text-graphite-500 text-sm mb-6">
        {viewingSelf ? 'Your account details, roles, and approval signature.' : 'Colleague profile.'}
      </p>

      <div className="bg-white rounded-xl border border-graphite-100 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar userId={profile.id} name={profile.fullName} />
          <div className="flex-1">
            <p className="font-display font-semibold text-graphite-900">{profile.fullName}</p>
            <p className="text-sm text-graphite-500">{profile.staffNumber}</p>
          </div>
          {viewingSelf && (
            <label className="text-sm text-olive-600 font-medium hover:underline cursor-pointer focus-ring">
              {photoUploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhoto} disabled={photoUploading} />
            </label>
          )}
        </div>

        {editing ? (
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-graphite-700 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-graphite-700 mb-1">Designation</label>
              <input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
            </div>
            <div className="flex gap-2 pt-1">
              <button disabled={saving} className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-md text-graphite-600 text-sm font-medium hover:bg-graphite-50 focus-ring">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {viewingSelf && (
              <div>
                <dt className="text-graphite-400 text-xs mb-0.5">Email</dt>
                <dd className="text-graphite-900">{profile.email}</dd>
              </div>
            )}
            {viewingSelf && (
              <div>
                <dt className="text-graphite-400 text-xs mb-0.5">Phone</dt>
                <dd className="text-graphite-900">{profile.phone || '—'}</dd>
              </div>
            )}
            <div>
              <dt className="text-graphite-400 text-xs mb-0.5">Designation</dt>
              <dd className="text-graphite-900">{profile.designation || '—'}</dd>
            </div>
            <div>
              <dt className="text-graphite-400 text-xs mb-0.5">Department</dt>
              <dd className="text-graphite-900">{profile.primaryDepartment?.name || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-graphite-400 text-xs mb-1">Roles</dt>
              <dd><RoleList deptAssignments={profile.deptAssignments} systemRole={profile.systemRole} /></dd>
            </div>
          </dl>
        )}

        {viewingSelf && !editing && (
          <button onClick={startEditing} className="mt-4 text-sm text-olive-600 font-medium hover:underline focus-ring">
            Edit details
          </button>
        )}
      </div>

      {viewingSelf && <ChangePasswordCard />}

      {viewingSelf && (
        <div className="bg-white rounded-xl border border-graphite-100 p-6">
          <h2 className="font-display font-semibold text-graphite-900 mb-1">Signature &amp; Stamp</h2>
          <p className="text-sm text-graphite-500 mb-4">
            Your signature is appended automatically to every document you upload, and to
            any document you approve as a reviewer.
            {canReview && ' Your official stamp is appended automatically whenever you approve a document.'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <AssetUpload
              label="Signature"
              kind="signature"
              currentAsset={profile.signatureAssets?.find((a) => a.kind === 'SIGNATURE')}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })}
            />
            {canReview && (
              <AssetUpload
                label="Official Stamp"
                kind="stamp"
                currentAsset={profile.signatureAssets?.find((a) => a.kind === 'STAMP')}
                onUploaded={() => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
