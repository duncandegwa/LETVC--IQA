import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import StatusBadge from './StatusBadge';
import DocumentActions from './DocumentActions';

const DECISION_STYLES = {
  APPROVED: 'text-olive-600 bg-olive-500/10',
  REJECTED: 'text-clay-600 bg-clay-500/10',
  RETURNED: 'text-clay-600 bg-clay-500/10',
};

const SORTS = {
  'Newest first': (a, b) => new Date(b.decidedAt) - new Date(a.decidedAt),
  'Oldest first': (a, b) => new Date(a.decidedAt) - new Date(b.decidedAt),
  'Trainer (A-Z)': (a, b) => (a.document.uploader?.fullName || '').localeCompare(b.document.uploader?.fullName || ''),
  'Department (A-Z)': (a, b) => (a.document.department?.name || '').localeCompare(b.document.department?.name || ''),
};

/** A reviewer's own record of what they've already decided on — every stage, filterable and sortable, each still downloadable. */
export default function ReviewHistory() {
  const [decisionFilter, setDecisionFilter] = useState('');
  const [sortLabel, setSortLabel] = useState('Newest first');

  const { data: history, isLoading } = useQuery({
    queryKey: ['review-history', decisionFilter],
    queryFn: () => api.get(`/reviews/history${decisionFilter ? `?decision=${decisionFilter}` : ''}`),
  });

  const sorted = useMemo(() => {
    if (!history) return [];
    return [...history].sort(SORTS[sortLabel]);
  }, [history, sortLabel]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        >
          <option value="">All decisions</option>
          <option value="APPROVED">Approved</option>
          <option value="RETURNED">Returned</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={sortLabel}
          onChange={(e) => setSortLabel(e.target.value)}
          className="border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
        >
          {Object.keys(SORTS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-graphite-300 text-sm">Loading…</p>
      ) : !sorted.length ? (
        <div className="bg-white rounded-xl border border-graphite-100 p-10 text-center text-graphite-500">
          Nothing decided yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-graphite-100 p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link to={`/documents/${a.document.id}`} className="font-display font-semibold text-graphite-900 hover:underline truncate block">
                  {a.document.title}
                </Link>
                <p className="text-sm text-graphite-500 mt-0.5">
                  {a.document.department?.name} · Trainer: {a.document.uploader?.fullName} ·
                  {' '}{a.decidedAt && new Date(a.decidedAt).toLocaleDateString('en-KE')}
                </p>
                {a.comment && <p className="text-sm text-graphite-600 mt-1 italic">"{a.comment}"</p>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${DECISION_STYLES[a.decision]}`}>
                  {a.decision}
                </span>
                <StatusBadge status={a.document.status} />
                <DocumentActions documentId={a.document.id} title={a.document.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
