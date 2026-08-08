import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import BroadcastComposer from '../../components/BroadcastComposer';

const TABS = ['Users', 'Departments & Assignments', 'Trainer Assignments', 'Notifications'];

function UsersPanel() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const [form, setForm] = useState({ fullName: '', staffNumber: '', email: '', phone: '', designation: '' });
  const [creating, setCreating] = useState(false);
  const [lastTempPassword, setLastTempPassword] = useState(null);

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.post('/users', form);
      setLastTempPassword({ email: created.email, tempPassword: created.tempPassword });
      setForm({ fullName: '', staffNumber: '', email: '', phone: '', designation: '' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user) {
    await api.post(`/users/${user.id}/${user.isActive ? 'deactivate' : 'activate'}`);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <form onSubmit={createUser} className="col-span-1 bg-white rounded-xl border border-graphite-100 p-5 h-fit">
        <h3 className="font-display font-semibold text-graphite-900 mb-4">Create user account</h3>
        {['fullName', 'staffNumber', 'email', 'phone', 'designation'].map((field) => (
          <div key={field} className="mb-3">
            <label className="block text-xs font-medium text-graphite-700 mb-1 capitalize">
              {field.replace(/([A-Z])/g, ' $1')}
            </label>
            <input
              required={field !== 'phone' && field !== 'designation'}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="w-full border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring"
            />
          </div>
        ))}
        <p className="text-xs text-graphite-500 mb-3">
          Every account can upload documents as a Trainer by default, and can never review
          anything unless granted a capability. Grant HOD / IQA / DP review capabilities
          from the Departments tab, or leave as-is for a trainer-only account.
        </p>
        <button disabled={creating} className="w-full py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring disabled:opacity-60">
          {creating ? 'Creating…' : 'Create account'}
        </button>

        {lastTempPassword && (
          <div className="mt-4 text-xs bg-gold-50 border border-gold-100 rounded-md p-3">
            <p className="font-medium text-graphite-900">Temporary password issued</p>
            <p className="text-graphite-700 mt-1">{lastTempPassword.email}</p>
            <p className="font-mono text-graphite-900 mt-1">{lastTempPassword.tempPassword}</p>
          </div>
        )}
      </form>

      <div className="col-span-2 bg-white rounded-xl border border-graphite-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graphite-50 text-graphite-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Staff No.</th>
              <th className="px-4 py-2.5 font-medium">Roles</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-4 text-graphite-300" colSpan={5}>Loading…</td></tr>
            ) : users?.map((u) => (
              <tr key={u.id} className="border-t border-graphite-100">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-graphite-900">{u.fullName}</div>
                  <div className="text-graphite-400 text-xs">{u.email}</div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.staffNumber}</td>
                <td className="px-4 py-2.5 text-xs text-graphite-500">
                  {u.systemRole === 'ADMIN' ? 'Administrator' : (
                    u.deptAssignments?.map((a) => `${a.role}${a.isActing ? ' (acting)' : ''} · ${a.department?.name}`).join(', ') || 'Trainer only (cannot review)'
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium ${u.isActive ? 'text-olive-600' : 'text-clay-600'}`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.systemRole !== 'ADMIN' && (
                    <button onClick={() => toggleActive(u)} className="text-xs text-graphite-500 hover:text-graphite-900 focus-ring">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartmentsPanel() {
  const queryClient = useQueryClient();
  const { data: departments, isLoading } = useQuery({ queryKey: ['admin-departments'], queryFn: () => api.get('/departments') });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [assignForm, setAssignForm] = useState({ departmentId: '', userId: '', role: 'HOD', isActing: false });

  async function createDepartment(e) {
    e.preventDefault();
    await api.post('/departments', deptForm);
    setDeptForm({ name: '', code: '' });
    queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
  }

  async function createAssignment(e) {
    e.preventDefault();
    await api.post(`/departments/${assignForm.departmentId}/assignments`, {
      userId: assignForm.userId, role: assignForm.role, isActing: assignForm.isActing,
    });
    queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1 space-y-6">
        <form onSubmit={createDepartment} className="bg-white rounded-xl border border-graphite-100 p-5">
          <h3 className="font-display font-semibold text-graphite-900 mb-4">New department</h3>
          <input required placeholder="Name" value={deptForm.name} onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full mb-3 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
          <input required placeholder="Code (e.g. ICT)" value={deptForm.code} onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
            className="w-full mb-3 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring" />
          <button className="w-full py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring">Create</button>
        </form>

        <form onSubmit={createAssignment} className="bg-white rounded-xl border border-graphite-100 p-5">
          <h3 className="font-display font-semibold text-graphite-900 mb-2">Assign reviewer capability</h3>
          <p className="text-xs text-graphite-500 mb-4">
            Mark as "acting/alternate" to register a fallback reviewer used automatically
            when the natural reviewer has a conflict of interest with a specific document.
          </p>
          <select required value={assignForm.departmentId} onChange={(e) => setAssignForm((f) => ({ ...f, departmentId: e.target.value }))}
            className="w-full mb-3 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring">
            <option value="">Department…</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select required value={assignForm.userId} onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))}
            className="w-full mb-3 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring">
            <option value="">User…</option>
            {users?.filter((u) => u.systemRole !== 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <select value={assignForm.role} onChange={(e) => setAssignForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full mb-3 border border-graphite-100 rounded-md px-3 py-2 text-sm focus-ring">
            <option value="HOD">HOD</option>
            <option value="IQA_OFFICER">IQA Officer</option>
            <option value="DP_ACADEMICS">DP Academics</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-graphite-700 mb-4">
            <input type="checkbox" checked={assignForm.isActing} onChange={(e) => setAssignForm((f) => ({ ...f, isActing: e.target.checked }))} />
            Acting / alternate reviewer
          </label>
          <button className="w-full py-2 rounded-md bg-olive-500 text-white text-sm font-medium hover:bg-olive-600 focus-ring">Assign</button>
        </form>
      </div>

      <div className="col-span-2 space-y-4">
        {isLoading ? (
          <p className="text-graphite-300 text-sm">Loading…</p>
        ) : departments?.map((dept) => (
          <div key={dept.id} className="bg-white rounded-xl border border-graphite-100 p-5">
            <h3 className="font-display font-semibold text-graphite-900">{dept.name} <span className="text-graphite-400 font-mono text-xs">{dept.code}</span></h3>
            <div className="mt-3 space-y-1.5">
              {dept.assignments?.length ? dept.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-graphite-700">
                    {a.user.fullName} — <span className="text-graphite-500">{a.role.replace('_', ' ')}{a.isActing ? ' (acting)' : ''}</span>
                  </span>
                </div>
              )) : <p className="text-sm text-graphite-400">No reviewer capabilities assigned yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainerAssignmentsPanel() {
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });

  const staff = (users || []).filter((u) => u.systemRole !== 'ADMIN');
  const hods = staff.filter((u) => u.deptAssignments?.some((a) => a.role === 'HOD'));
  const iqaOfficers = staff.filter((u) => u.deptAssignments?.some((a) => a.role === 'IQA_OFFICER'));

  return (
    <div className="bg-white rounded-xl border border-graphite-100 overflow-hidden">
      <div className="p-5 border-b border-graphite-100">
        <h3 className="font-display font-semibold text-graphite-900">Trainer reviewer assignments</h3>
        <p className="text-xs text-graphite-500 mt-1">
          Assign each trainer's specific HOD and IQA Officer reviewer. Until assigned, the
          system falls back to the department's general reviewer pool. A trainer can never
          be assigned to review their own documents — the system blocks that automatically.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-graphite-50 text-graphite-500 text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Trainer</th>
            <th className="px-4 py-2.5 font-medium">HOD reviewer</th>
            <th className="px-4 py-2.5 font-medium">IQA reviewer</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-4 py-4 text-graphite-300" colSpan={3}>Loading…</td></tr>
          ) : staff.map((trainer) => (
            <TrainerAssignmentRow
              key={trainer.id}
              trainer={trainer}
              hods={hods.filter((h) => h.id !== trainer.id)}
              iqaOfficers={iqaOfficers.filter((i) => i.id !== trainer.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainerAssignmentRow({ trainer, hods, iqaOfficers }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: assignment } = useQuery({
    queryKey: ['reviewer-assignment', trainer.id],
    queryFn: () => api.get(`/users/${trainer.id}/reviewer-assignment`),
  });

  async function save(field, value) {
    setBusy(true);
    try {
      await api.post(`/users/${trainer.id}/reviewer-assignment`, {
        hodId: assignment?.hodId || null,
        iqaId: assignment?.iqaId || null,
        [field]: value || null,
      });
      queryClient.invalidateQueries({ queryKey: ['reviewer-assignment', trainer.id] });
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-graphite-100">
      <td className="px-4 py-2.5">
        <div className="font-medium text-graphite-900">{trainer.fullName}</div>
        <div className="text-graphite-400 text-xs">{trainer.staffNumber}</div>
      </td>
      <td className="px-4 py-2.5">
        <select
          disabled={busy}
          value={assignment?.hodId || ''}
          onChange={(e) => save('hodId', e.target.value)}
          className="w-full border border-graphite-100 rounded-md px-2 py-1.5 text-xs focus-ring"
        >
          <option value="">Use department pool…</option>
          {hods.map((h) => <option key={h.id} value={h.id}>{h.fullName}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <select
          disabled={busy}
          value={assignment?.iqaId || ''}
          onChange={(e) => save('iqaId', e.target.value)}
          className="w-full border border-graphite-100 rounded-md px-2 py-1.5 text-xs focus-ring"
        >
          <option value="">Use department pool…</option>
          {iqaOfficers.map((i) => <option key={i.id} value={i.id}>{i.fullName}</option>)}
        </select>
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-graphite-900 mb-1">Administration</h1>
      <p className="text-graphite-500 text-sm mb-6">
        Manage user accounts, departments, and reviewer assignments — including the
        alternate reviewers used when a conflict of interest is detected.
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
      {tab === 'Users' ? <UsersPanel /> : tab === 'Departments & Assignments' ? <DepartmentsPanel /> : tab === 'Trainer Assignments' ? <TrainerAssignmentsPanel /> : <BroadcastComposer />}
    </div>
  );
}
