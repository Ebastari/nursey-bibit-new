import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, ClipboardPen, Camera, Package, Bell, Shield } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';
import { useStore } from '../store/useStore';

const COMPANY_LOGO = 'https://i.ibb.co.com/xSTT9wJK/download.png';

const navItems = [
  { to: '/', icon: LayoutGrid, label: 'Home' },
  { to: '/input', icon: ClipboardPen, label: 'Input' },
  { to: '/verify', icon: Camera, label: 'Scan', center: true },
  { to: '/stock', icon: Package, label: 'Stock' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/input': 'Input Cepat',
  '/stock': 'Stok Bibit',
  '/performance': 'Kinerja Nursery',
  '/distribution': 'Distribusi',
  '/documents': 'Dokumen',
  '/alerts': 'Peringatan',
  '/surat-jalan': 'Surat Jalan',
  '/verify': 'Verifikasi Dokumen',
};

export function Layout() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] || 'Smart Nursery';
  const { isAdmin } = useStore();

  return (
    <div className="min-h-screen bg-[#f8f9fb] mx-auto max-w-[420px] relative shadow-2xl">
      {/* Top Header — Premium gradient */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white px-5 flex items-center gap-3.5 h-14 shadow-[0_2px_12px_rgba(5,150,105,0.25)]">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm overflow-hidden">
          <img src={COMPANY_LOGO} alt="Logo" className="w-7 h-7 object-contain" />
        </div>
        <h1 className="text-[15px] font-semibold tracking-wide truncate flex-1">{title}</h1>
        <NotificationBell />
        {isAdmin && (
          <NavLink to="/approval" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 text-xs font-semibold">
            <Shield className="w-4 h-4" />
            Admin
          </NavLink>
        )}
      </header>

      {/* Main content */}
      <main className="px-4 py-5 pb-24 min-h-[calc(100vh-3.5rem)]">
        <Outlet />
      </main>

      {/* Bottom Navigation — Frosted glass */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white/80 backdrop-blur-xl border-t border-gray-200/60 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-around h-[4.25rem]">
          {navItems.map(({ to, icon: Icon, label, center }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 w-full h-full transition-all duration-200 ${
                  center ? '' : isActive ? 'text-emerald-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) =>
                center ? (
                  <div className="flex flex-col items-center -mt-7">
                    <div
                      className={`w-[3.25rem] h-[3.25rem] rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                        isActive
                          ? 'bg-emerald-600 shadow-emerald-400/40 scale-105'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-300/30'
                      }`}
                    >
                      <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                    </div>
                    <span
                      className={`text-[10px] mt-1 transition-all duration-200 ${
                        isActive ? 'text-emerald-600 font-bold' : 'text-gray-400 font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      className={`px-5 py-1.5 rounded-full transition-all duration-300 ease-out ${
                        isActive ? 'bg-emerald-100 scale-100' : 'bg-transparent scale-90'
                      }`}
                    >
                      <Icon className="w-[1.15rem] h-[1.15rem]" strokeWidth={isActive ? 2.5 : 1.8} />
                    </div>
                    <span
                      className={`text-[10px] leading-tight transition-all duration-200 ${
                        isActive ? 'font-bold tracking-tight' : 'font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  );
}
