import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import DocumentActions from './DocumentActions';
import { documentTypeLabel } from '../lib/documentTypes';

/**
 * Renders a reviewer's queue. Because /api/reviews/queue can structurally
 * never contain the viewer's own uploads (see reviewerAssignment.js +
 * reviewController.js), there is no "hide the approve button" branch needed
 * here — the conflict-of-interest exclusion happened before this data ever
 * reached the browser. This component only ever shows documents the viewer
 * is legitimately allowed to act on.
 */
export default function ReviewQueue({ stageLabel }) {
  const queryClient = useQueryClient();
  const { data: queue, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => api.get('/reviews/queue'),
  });
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function act(assignmentId, action) {
    setBusyId(assignmentId);
    try {
      await api.post(`/reviews/${assignmentId}/${action}`, {
        comment: commentDrafts[assignmentId] || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <p className="text-graphite-300 text-sm">Loading queue…</p>;
  if (!queue?.length) {
    return (
      <div className="bg-white rounded-xl border border-graphite-100 p-10 text-center">
        <p className="text-graphite-500">Nothing pending your review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((assignment) => {
        const doc = assignment.document;
        return (
          <div key={assignment.id} className="bg-white rounded-xl border border-graphite-100 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <Link to={`/documents/${doc.id}`} className="font-display font-semibold text-graphite-900 hover:underline">
                  {doc.title}
                </Link>
                <p className="text-sm text-graphite-500 mt-0.5">
                  {documentTypeLabel(doc.type)} · {doc.department?.name} ·
                  {' '}Submitted by{' '}
                  <Link to={`/profile/${doc.uploader?.id}`} className="hover:underline">{doc.uploader?.fullName}</Link>
                </p>
              </div>
              <StatusBadge status={doc.status} />
            </div>

            <div className="mb-4">
              <WorkflowStepper status={doc.status} />
            </div>

            <div className="mb-4">
              <DocumentActions documentId={doc.id} title={doc.title} />
            </div>

            <textarea
              placeholder="Add a comment (required for return/reject)…"
              value={commentDrafts[assignment.id] || ''}
              onChange={(e) => setCommentDrafts((d) => ({ ...d, [assignment.id]: e.target.value }))}
              className="w-full text-sm border border-graphite-100 rounded-md px-3 py-2 mb-3 focus-ring focus:border-olive-500"
              rows={2}
            />

            <div className="flex gap-2">
              <button
                disabled={busyId === assignment.id}
                onClick={() => act(assignment.id, 'approve')}
                className="px-4 py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60"
              >
                Approve
              </button>
              <button
                disabled={busyId === assignment.id}
                onClick={() => act(assignment.id, 'return')}
                className="px-4 py-2 rounded-md bg-gold-500 text-graphite-900 text-sm font-medium hover:bg-gold-600 focus-ring disabled:opacity-60"
              >
                Return for Corrections
              </button>
              <button
                disabled={busyId === assignment.id}
                onClick={() => act(assignment.id, 'reject')}
                className="px-4 py-2 rounded-md bg-clay-500 text-white text-sm font-medium hover:bg-clay-600 focus-ring disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
