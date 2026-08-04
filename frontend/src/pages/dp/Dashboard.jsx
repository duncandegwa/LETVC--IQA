import { useState } from 'react';
import ReviewQueue from '../../components/ReviewQueue';
import ReviewHistory from '../../components/ReviewHistory';
import ApprovedDocumentsBrowser from '../../components/ApprovedDocumentsBrowser';
import BroadcastComposer from '../../components/BroadcastComposer';

const TABS = ['Pending Verification', 'My Review History', 'Approved Documents', 'Send Notification'];

export default function DpDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-graphite-900 mb-1">DP Verification</h1>
      <p className="text-graphite-500 text-sm mb-6">
        Documents assigned to you for Deputy Principal Academics verification. Your own
        uploads never appear here — they are automatically routed to a delegated verifier.
      </p>
      <div className="flex gap-1 mb-6 border-b border-graphite-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px focus-ring ${
              tab === t ? 'border-olive-500 text-olive-600' : 'border-transparent text-graphite-500 hover:text-graphite-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === TABS[0] && <ReviewQueue stageLabel="DP Verification" />}
      {tab === TABS[1] && <ReviewHistory />}
      {tab === TABS[2] && <ApprovedDocumentsBrowser />}
      {tab === TABS[3] && <BroadcastComposer />}
    </div>
  );
}
