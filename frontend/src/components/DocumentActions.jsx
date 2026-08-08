import { useState } from 'react';
import { openPreview, downloadFile } from '../api/client';

/**
 * Every stage of a document's lifecycle needs a working Preview/Download —
 * not just while it's sitting in someone's review queue. Both buttons here
 * hit the same backend access check (userCanAccessDocument in
 * documentController.js) regardless of the document's current status, so
 * this component is safe to render anywhere a document is shown.
 */
export default function DocumentActions({ documentId, title }) {
  const [busy, setBusy] = useState(null);

  async function handlePreview() {
    setBusy('preview');
    try {
      await openPreview(`/documents/${documentId}/preview`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy('download');
    try {
      await downloadFile(`/documents/${documentId}/download`, `${title || 'document'}.pdf`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handlePreview}
        disabled={busy !== null}
        className="text-sm text-olive-600 font-medium hover:underline disabled:opacity-60 focus-ring"
      >
        {busy === 'preview' ? 'Opening…' : 'Preview'}
      </button>
      <button
        onClick={handleDownload}
        disabled={busy !== null}
        className="text-sm text-olive-600 font-medium hover:underline disabled:opacity-60 focus-ring"
      >
        {busy === 'download' ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
}
