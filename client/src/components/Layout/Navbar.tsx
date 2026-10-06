import { useRef, useState, useEffect } from 'react';
import {
  FiBell, FiSearch, FiHome, FiChevronRight, FiChevronLeft,
  FiUser, FiSettings, FiUsers, FiLogOut, FiHelpCircle, FiGlobe,
} from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/records': 'Records',
  '/forms': 'Forms',
  '/workflows': 'Workflows',
  '/integrations': 'Integrations',
  '/anomalies': 'Anomalies',
  '/reports': 'Reports',
  '/marketplace': 'Marketplace',
  '/settings': 'Settings',
  '/quality': 'Data Quality',
  '/notifications': 'Notifications',
  '/team': 'Team',
  '/intelligence': 'Intelligence',
};

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard', path: '/dashboard' }];

  const crumbs: { label: string; path: string }[] = [];
  let accumulated = '';

  for (const seg of segments) {
    accumulated += '/' + seg;
    if (ROUTE_LABELS[accumulated]) {
      crumbs.push({ label: ROUTE_LABELS[accumulated], path: accumulated });
    } else if (seg.match(/^[0-9a-f]{8,}$/i)) {
      crumbs.push({ label: `#${seg.substring(0, 8)}`, path: accumulated });
    } else {
      crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1), path: accumulated });
    }
  }

  return crumbs;
}

interface NavbarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Navbar({ collapsed, onToggle }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = getBreadcrumbs(location.pathname);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const orgName = useAuthStore((s) => s.orgName) || user?.orgName || 'My Organization';

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.given_name && user?.family_name
    ? `${user.given_name.charAt(0)}${user.family_name.charAt(0)}`
    : user?.given_name?.charAt(0) || user?.email?.charAt(0) || 'U';

  return (
    <header className="h-[52px] bg-white/90 backdrop-blur-md border-b border-[#E3E7EE] flex items-center justify-between px-5 sticky top-0 z-40">
      <div className="flex items-center gap-3.5">
        <button
          onClick={onToggle}
          className="text-xs text-[#5F6880] cursor-pointer p-1.5 rounded-md hover:bg-[#F7F8FA] transition-colors border-none bg-transparent"
        >
          {collapsed ? <FiChevronRight className="text-xs" /> : <FiChevronLeft className="text-xs" />}
        </button>

        <nav className="flex items-center gap-1.5 text-[10px] text-[#99A1B3] font-[DM_Sans]">
          <FiHome className="text-[9px]" />
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <FiChevronRight className="text-[9px] text-[#CBD2DE]" />}
              <span className={i === crumbs.length - 1 ? 'font-semibold text-[#1A1F2E]' : ''}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#86EFAC] rounded-full">
          <FiGlobe className="text-[9px] text-[#009B3A]" />
          <span className="text-[10px] font-medium text-[#007A2E] truncate max-w-[160px]">
            {orgName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#F7F8FA] border border-[#E3E7EE] rounded-[7px] px-2.5 py-1.5 w-[180px] focus-within:border-[#009B3A] focus-within:bg-white transition-colors">
          <FiSearch className="text-[10px] text-[#99A1B3]" />
          <input
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-[11px] text-[#1A1F2E] w-full font-[DM_Sans] placeholder:text-[#99A1B3]"
          />
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative text-xs text-[#5F6880] cursor-pointer p-1.5 rounded-md hover:bg-[#F7F8FA] transition-colors border-none bg-transparent"
        >
          <FiBell className="text-xs" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#CE1126] rounded-full" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 cursor-pointer hover:bg-[#F7F8FA] rounded-lg p-1 transition-colors border-none bg-transparent"
          >
            <div className="w-[30px] h-[30px] rounded-[7px] bg-gradient-to-br from-[#009B3A] to-[#E8611D] flex items-center justify-center text-white text-[11px] font-bold font-[Space_Grotesk] flex-shrink-0">
              {initials}
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <div className="text-[10px] font-semibold text-[#1A1F2E] truncate max-w-[100px]">
                {user?.given_name || user?.preferred_username || 'User'}
              </div>
              <div className="text-[8px] text-[#99A1B3]">Admin</div>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-[220px] bg-white border border-[#E3E7EE] rounded-[9px] shadow-lg z-50 py-1">
              <div className="px-3 py-2 border-b border-[#EEF0F4]">
                <div className="text-xs font-semibold text-[#1A1F2E]">
                  {user?.given_name} {user?.family_name}
                </div>
                <div className="text-[9px] text-[#99A1B3]">{user?.email}</div>
                {orgName && (
                  <div className="text-[9px] text-[#009B3A] mt-0.5 font-medium flex items-center gap-1">
                    <FiGlobe className="text-[8px]" /> {orgName}
                  </div>
                )}
              </div>

              <button onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#5F6880] hover:bg-[#F7F8FA] transition-colors border-none bg-transparent cursor-pointer text-left">
                <FiUser className="text-xs" /> My Account
              </button>
              <button onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#5F6880] hover:bg-[#F7F8FA] transition-colors border-none bg-transparent cursor-pointer text-left">
                <FiSettings className="text-xs" /> Settings
              </button>
              <button onClick={() => { navigate('/team'); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#5F6880] hover:bg-[#F7F8FA] transition-colors border-none bg-transparent cursor-pointer text-left">
                <FiUsers className="text-xs" /> Team Management
              </button>

              <div className="border-t border-[#EEF0F4] my-1" />

              <button onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#5F6880] hover:bg-[#F7F8FA] transition-colors border-none bg-transparent cursor-pointer text-left">
                <FiHelpCircle className="text-xs" /> Help & Support
              </button>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#CE1126] hover:bg-[#FFF5F5] transition-colors border-none bg-transparent cursor-pointer text-left">
                <FiLogOut className="text-xs" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
