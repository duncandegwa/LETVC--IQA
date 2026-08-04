import { auth } from '../firebase';

const BASE_URL = '/api';

async function authHeaders() {
  const headers = {};
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = await authHeaders();
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * PDFs, profile photos, and signature/stamp images are all served behind
 * requireAuth — a plain `<a href="/api/...">` or `<img src="/api/...">`
 * would hit those routes with no Authorization header at all and get a 401.
 * These two helpers fetch the file WITH the current Firebase ID token, then
 * hand the browser a local blob: URL to open/download/render instead.
 */
async function fetchBlob(path) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load file (${res.status})`);
  }
  return res.blob();
}

export async function openPreview(path) {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke well after the new tab has had time to load the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFile(path, filename) {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { fetchBlob };

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
