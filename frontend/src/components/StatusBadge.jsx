const STYLES = {
  DRAFT: 'bg-graphite-100 text-graphite-700',
  PENDING_HOD_REVIEW: 'bg-gold-100 text-gold-700',
  PENDING_IQA_REVIEW: 'bg-gold-100 text-gold-700',
  PENDING_DP_VERIFICATION: 'bg-gold-100 text-gold-700',
  RETURNED_BY_HOD: 'bg-clay-500/10 text-clay-600',
  RETURNED_BY_IQA: 'bg-clay-500/10 text-clay-600',
  RETURNED_BY_DP: 'bg-clay-500/10 text-clay-600',
  APPROVED: 'bg-olive-100 text-olive-700',
  ARCHIVED: 'bg-graphite-100 text-graphite-500',
  NEEDS_ADMIN_ASSIGNMENT: 'bg-clay-500/10 text-clay-600',
};

const LABELS = {
  DRAFT: 'Draft',
  PENDING_HOD_REVIEW: 'Pending HOD Review',
  RETURNED_BY_HOD: 'Returned by HOD',
  PENDING_IQA_REVIEW: 'Pending IQA Review',
  RETURNED_BY_IQA: 'Returned by IQA',
  PENDING_DP_VERIFICATION: 'Pending DP Verification',
  RETURNED_BY_DP: 'Returned by DP',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
  NEEDS_ADMIN_ASSIGNMENT: 'Needs Admin Assignment',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STYLES[status] || 'bg-graphite-100 text-graphite-700'}`}>
      {LABELS[status] || status}
    </span>
  );
}
