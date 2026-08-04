import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import WorkflowStepper from '../../components/WorkflowStepper';
import DocumentActions from '../../components/DocumentActions';
import { DOCUMENT_TYPES, ACADEMIC_YEARS, SEMESTERS, documentTypeLabel } from '../../lib/documentTypes';

function UploadForm({ onUploaded }) {
  const [form, setForm] = useState({
    type: DOCUMENT_TYPES[0].value, title: '', academicYear: ACADEMIC_YEARS[0], semester: SEMESTERS[0],
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') });
  const [departmentId, setDepartmentId] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return alert('Please attach a PDF file.');
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append('departmentId', departmentId);
      body.append('file', file);
      body.append('submitNow', 'true');
      await api.post('/documents', body, { isForm: true });
      setForm({ type: DOCUMENT_TYPES[0].value, title: '', academicYear: ACADEMIC_YEARS[0], semester: SEMESTERS[0] });
      setFile(null);
      onUploaded();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-graphite-100 p-5 mb-8">
      <h3 className="font-display font-semibold text-graphite-900 mb-4">Upload a new document</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-graphite-700 mb-1.5">Document type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          >
            {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-graphite-700 mb-1.5">Department</label>
          <select
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          >
            <option value="">Select…</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-graphite-700 mb-1.5">Title</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          placeholder="e.g. ICT Level 5 — Term 2 Learning Plan"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-graphite-700 mb-1.5">Academic year</label>
          <select
            value={form.academicYear}
            onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          >
            {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-graphite-700 mb-1.5">Semester</label>
          <select
            value={form.semester}
            onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
            className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
          >
            {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-graphite-700 mb-1.5">PDF file</label>
        <input required type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])}
          className="w-full text-sm" />
      </div>
      <button disabled={submitting} className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60">
        {submitting ? 'Uploading…' : 'Upload & Submit for Review'}
      </button>
    </form>
  );
}

export default function TrainerDashboard() {
  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useQuery({
    queryKey: ['my-documents'],
    queryFn: () => api.get('/documents/mine'),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-graphite-900 mb-1">My Documents</h1>
      <p className="text-graphite-500 text-sm mb-6">
        Upload Learning Plans and Session Plans and track them through review.
      </p>

      <UploadForm onUploaded={() => queryClient.invalidateQueries({ queryKey: ['my-documents'] })} />

      {isLoading ? (
        <p className="text-graphite-300 text-sm">Loading…</p>
      ) : !documents?.length ? (
        <div className="bg-white rounded-xl border border-graphite-100 p-10 text-center text-graphite-500">
          You haven't uploaded any documents yet.
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const commented = [...(doc.reviews || [])].reverse().find((r) => r.comment);
            return (
            <div key={doc.id} className="bg-white rounded-xl border border-graphite-100 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <Link to={`/documents/${doc.id}`} className="font-display font-semibold text-graphite-900 hover:underline">
                    {doc.title}
                  </Link>
                  <p className="text-sm text-graphite-500 mt-0.5">
                    {documentTypeLabel(doc.type)} · {doc.department?.name}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </div>
              <WorkflowStepper status={doc.status} />

              {doc.status === 'NEEDS_ADMIN_ASSIGNMENT' && (
                <p className="mt-3 text-sm text-clay-600 bg-clay-500/10 rounded-md px-3 py-2">
                  No reviewer could be automatically assigned without a conflict of interest.
                  The Administrator has been notified to assign one manually.
                </p>
              )}

              {commented && (
                <div className="mt-3 text-sm bg-graphite-50 rounded-md px-3 py-2">
                  <p className="text-graphite-500 text-xs mb-0.5">
                    {commented.assignee?.fullName} — {commented.stage.replace('_', ' ')}
                  </p>
                  <p className="text-graphite-700 italic">"{commented.comment}"</p>
                </div>
              )}

              <div className="mt-4">
                <DocumentActions documentId={doc.id} title={doc.title} />
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
