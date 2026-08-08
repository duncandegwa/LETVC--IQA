import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/client';
import DocumentActions from './DocumentActions';

/** Lets DP Academics download every approved document, filtered by department, trainer, or IQA officer. */
export default function ApprovedDocumentsBrowser() {
  const [filters, setFilters] = useState({ departmentId: '', trainerId: '', iqaOfficerId: '' });

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') });
  const { data: users } = useQuery({ queryKey: ['users-directory'], queryFn: () => api.get('/users/directory') });

  const trainers = users || [];
  const iqaOfficers = (users || []).filter((u) =>
    u.deptAssignments?.some((a) => a.role === 'IQA_OFFICER')
  );

  const query = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
  const { data: documents, isLoading } = useQuery({
    queryKey: ['approved-documents', filters],
    queryFn: () => api.get(`/documents/approved${query ? `?${query}` : ''}`),
  });

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <select
          value={filters.departmentId}
          onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
          className="border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        >
          <option value="">All departments</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filters.trainerId}
          onChange={(e) => setFilters((f) => ({ ...f, trainerId: e.target.value }))}
          className="border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        >
          <option value="">All trainers</option>
          {trainers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <select
          value={filters.iqaOfficerId}
          onChange={(e) => setFilters((f) => ({ ...f, iqaOfficerId: e.target.value }))}
          className="border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        >
          <option value="">All IQA officers</option>
          {iqaOfficers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-graphite-300 text-sm">Loading…</p>
      ) : !documents?.length ? (
        <div className="bg-white rounded-xl border border-graphite-100 p-10 text-center text-graphite-500">
          No approved documents match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-graphite-100 p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link to={`/documents/${doc.id}`} className="font-display font-semibold text-graphite-900 hover:underline truncate block">
                  {doc.title}
                </Link>
                <p className="text-sm text-graphite-500 mt-0.5">
                  {doc.department?.name} · Trainer: {doc.uploader?.fullName}
                </p>
              </div>
              <DocumentActions documentId={doc.id} title={doc.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
