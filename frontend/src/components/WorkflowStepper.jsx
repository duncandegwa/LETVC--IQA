import React from 'react';

const STAGES = [
  { key: 'TRAINER', label: 'Trainer' },
  { key: 'HOD', label: 'HOD' },
  { key: 'IQA', label: 'IQA Officer' },
  { key: 'DP', label: 'DP Academics' },
];

// Maps a Document.status to how far along the chain we are, so the same
// stepper works for every role's view of a document.
function stageIndexForStatus(status) {
  if (status === 'DRAFT') return 0;
  if (['PENDING_HOD_REVIEW', 'RETURNED_BY_HOD'].includes(status)) return 1;
  if (['PENDING_IQA_REVIEW', 'RETURNED_BY_IQA'].includes(status)) return 2;
  if (['PENDING_DP_VERIFICATION', 'RETURNED_BY_DP'].includes(status)) return 3;
  if (['APPROVED', 'ARCHIVED'].includes(status)) return 4;
  return 0;
}

/**
 * The system's signature visual: a horizontal chain showing exactly where a
 * document sits in the mandatory Trainer -> HOD -> IQA -> DP sequence.
 * It appears on every document detail view, in every role's dashboard —
 * a constant, literal rendering of "a document cannot skip a stage."
 */
export default function WorkflowStepper({ status }) {
  const current = stageIndexForStatus(status);
  const isReturned = status?.startsWith('RETURNED');

  return (
    <div className="flex items-center w-full" role="list" aria-label="Approval progress">
      {STAGES.map((stage, i) => {
        const stepNo = i + 1;
        const done = stepNo < current;
        const active = stepNo === current;
        return (
          <React.Fragment key={stage.key}>
            <div className="flex flex-col items-center gap-1.5" role="listitem">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold font-mono border-2 transition-colors',
                  done && 'bg-olive-500 border-olive-500 text-white',
                  active && !isReturned && 'bg-gold-500 border-gold-500 text-graphite-900',
                  active && isReturned && 'bg-clay-500 border-clay-500 text-white',
                  !done && !active && 'bg-white border-graphite-100 text-graphite-300',
                ].filter(Boolean).join(' ')}
              >
                {done ? '✓' : stepNo}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-graphite-900' : 'text-graphite-300'}`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${stepNo < current ? 'bg-olive-500' : 'bg-graphite-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
