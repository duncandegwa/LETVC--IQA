import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import WorkflowStepper from '../../components/WorkflowStepper';
import DocumentActions from '../../components/DocumentActions';
import AuthedImage from '../../components/AuthedImage';
import DiscussionThread from '../../components/DiscussionThread';
import { documentTypeLabel } from '../../lib/documentTypes';

const STAGE_LABELS = { HOD_REVIEW: 'HOD Review', IQA_REVIEW: 'IQA Review', DP_VERIFICATION: 'DP Verification' };
const DECISION_STYLES = {
  PENDING: 'text-graphite-400',
  APPROVED: 'text-olive-600',
  REJECTED: 'text-clay-600',
  RETURNED: 'text-clay-600',
};

export default function DocumentDetail() {
  const { id } = useParams();
  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.get(`/documents/${id}`),
  });

  if (isLoading) return <p className="text-graphite-300 text-sm">Loading…</p>;
  if (error) {
    return (
      <div className="bg-clay-500/10 text-clay-600 rounded-xl p-6 text-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div>
      <Link to="/trainer" className="text-sm text-graphite-400 hover:text-graphite-700 mb-4 inline-block">
        ← Back
      </Link>

      <div className="bg-white rounded-xl border border-graphite-100 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-graphite-900">{doc.title}</h1>
            <p className="text-sm text-graphite-500 mt-0.5">
              {documentTypeLabel(doc.type)} · {doc.department?.name} ·
              {' '}{doc.academicYear} · {doc.semester}
            </p>
          </div>
          <StatusBadge status={doc.status} />
        </div>

        <div className="mb-6">
          <WorkflowStepper status={doc.status} />
        </div>

        {/* Who uploaded it — visible to every authorized viewer, including reviewers. */}
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-graphite-100">
          <AuthedImage
            path={`/users/${doc.uploader?.id}/photo`}
            alt={doc.uploader?.fullName}
            className="w-10 h-10 rounded-full object-cover bg-graphite-100"
            fallback={
              <div className="w-10 h-10 rounded-full bg-olive-100 text-olive-700 flex items-center justify-center font-display font-semibold text-sm">
                {doc.uploader?.fullName?.[0] || '?'}
              </div>
            }
          />
          <div>
            <Link to={`/profile/${doc.uploader?.id}`} className="text-sm font-medium text-graphite-900 hover:underline">
              {doc.uploader?.fullName}
            </Link>
            <p className="text-xs text-graphite-500">{doc.uploader?.designation || 'Trainer'} — Uploaded by</p>
          </div>
        </div>

        {doc.status === 'NEEDS_ADMIN_ASSIGNMENT' && (
          <p className="mb-5 text-sm text-clay-600 bg-clay-500/10 rounded-md px-3 py-2">
            No reviewer could be automatically assigned without a conflict of interest.
            The Administrator has been notified to assign one manually.
          </p>
        )}

        <DocumentActions documentId={doc.id} title={doc.title} />
      </div>

      {/* Review history — reviewer name, decision, and timestamp at every stage
          so far. Once a stage is approved, the same PDF gets that reviewer's
          name/date/signature/stamp appended — this list is the on-screen
          record of the same trail. */}
      <div className="bg-white rounded-xl border border-graphite-100 p-6 mb-6">
        <h2 className="font-display font-semibold text-graphite-900 mb-4">Review history</h2>
        {!doc.reviews?.length ? (
          <p className="text-sm text-graphite-400">Not yet submitted for review.</p>
        ) : (
          <div className="space-y-3">
            {doc.reviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b border-graphite-50 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-graphite-900">{STAGE_LABELS[r.stage] || r.stage}</p>
                  <p className="text-graphite-500 text-xs mt-0.5">
                    {r.assignee?.fullName || 'Unassigned'}
                    {r.wasReassignedForConflict && ' (alternate reviewer — conflict of interest)'}
                  </p>
                  {r.comment && <p className="text-graphite-600 text-xs mt-1 italic">"{r.comment}"</p>}
                </div>
                <div className="text-right">
                  <p className={`font-medium ${DECISION_STYLES[r.decision]}`}>{r.decision}</p>
                  {r.decidedAt && (
                    <p className="text-graphite-400 text-xs">{new Date(r.decidedAt).toLocaleString('en-KE')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version history — every replaced file and every automatic re-stamp
          after a successful review. Preview/Download above always serves
          the latest version. */}
      <div className="bg-white rounded-xl border border-graphite-100 p-6">
        <h2 className="font-display font-semibold text-graphite-900 mb-4">Version history</h2>
        <div className="space-y-2">
          {doc.versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <span className="text-graphite-700">
                Version {v.versionNo}{v.isFinal && ' — Final approved copy'}
              </span>
              <span className="text-graphite-400 text-xs">{new Date(v.uploadedAt).toLocaleString('en-KE')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <DiscussionThread documentId={doc.id} />
      </div>
    </div>
  );
}
