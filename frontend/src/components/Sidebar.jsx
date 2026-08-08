import { NavLink } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';
import AuthedImage from './AuthedImage';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/trainer', label: 'My Documents', always: true },
  { to: '/hod', label: 'HOD Review', capKey: 'hod' },
  { to: '/iqa', label: 'IQA Review', capKey: 'iqa' },
  { to: '/dp', label: 'DP Verification', capKey: 'dp' },
  { to: '/admin', label: 'Administration', capKey: 'isAdmin' },
];

export default function Sidebar() {
  const { user, capabilities, logout } = useAuth();

  const visible = NAV_ITEMS.filter((item) => {
    if (item.always) return true;
    if (!capabilities) return false;
    if (item.capKey === 'isAdmin') return capabilities.isAdmin;
    return (capabilities[item.capKey]?.length || 0) + (capabilities[`${item.capKey}Acting`]?.length || 0) > 0;
  });

  return (
    <aside className="w-64 bg-graphite-700 text-white flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.png" alt="Laikipia East TVC" className="w-11 h-11 rounded-full bg-white object-contain p-0.5 shrink-0" />
        <div>
          <p className="font-display text-base font-semibold leading-tight">Laikipia East TVC</p>
          <p className="text-xs text-gold-300 font-medium tracking-wide uppercase mt-0.5">IQA System</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors focus-ring ${
                isActive ? 'bg-olive-500 text-white' : 'text-graphite-100 hover:bg-white/10'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {user && (
          <div className="flex items-center gap-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex-1 flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-ring min-w-0 ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/10'
                }`
              }
            >
              <AuthedImage
                path={`/users/${user.id}/photo`}
                alt={user.fullName}
                className="w-7 h-7 rounded-full object-cover shrink-0"
                fallback={
                  <div className="w-7 h-7 rounded-full bg-gold-500 text-graphite-900 flex items-center justify-center font-display font-semibold text-xs shrink-0">
                    {user.fullName?.[0] || '?'}
                  </div>
                }
              />
              <span className="truncate text-graphite-100">{user.fullName}</span>
            </NavLink>
            <NotificationBell />
          </div>
        )}
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-graphite-100 hover:bg-white/10 focus-ring"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
