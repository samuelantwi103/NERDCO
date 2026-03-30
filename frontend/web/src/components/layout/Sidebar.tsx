'use client';
import { useState } from 'react';
import { ProfileModal } from '@/components/ProfileModal';
import { useRouter, usePathname } from 'next/navigation';
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components';
import {
  AlertUrgentRegular,
  GridRegular,
  VehicleCarRegular,
  PeopleRegular,
  DataBarVerticalRegular,
  BuildingRegular,
  SignOutRegular,
  MapRegular,
  HeartPulseRegular,
  PlayCircleRegular,
} from '@fluentui/react-icons';
import { useAuth, UserRole } from '@/lib/context/AuthContext';

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const useStyles = makeStyles({
  sidebar: {
    width: '224px',
    minWidth: '224px',
    height: '100vh',
    background: 'var(--gray-950)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  /* Brand */
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 20px 0',
    marginBottom: '24px',
    flexShrink: 0,
  },
  brandMark: {
    width: '28px',
    height: '28px',
    background: '#FFFFFF',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--gray-950)',
    letterSpacing: '-0.5px',
    flexShrink: 0,
  },
  brandName: {
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '-0.2px',
    color: '#FFFFFF',
  },
  brandSub: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    lineHeight: '1.2',
    display: 'block',
  },

  /* Nav */
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.7px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    padding: '16px 10px 6px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '13.5px',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
    userSelect: 'none',
    ':hover': {
      background: 'rgba(255,255,255,0.07)',
      color: 'rgba(255,255,255,0.85)',
    },
  },
  activeItem: {
    background: 'rgba(255,255,255,0.10)',
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activeIndicator: {
    width: '3px',
    height: '14px',
    background: '#FFFFFF',
    borderRadius: '2px',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  iconWrap: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.7,
  },
  activeIconWrap: { opacity: 1 },

  /* Footer */
  footer: {
    padding: '10px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '6px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 0,
  },
  userInfo: { flex: 1, overflow: 'hidden', minWidth: 0 },
  userName: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#FFFFFF',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '10.5px',
    color: 'rgba(255,255,255,0.35)',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
    ':hover': {
      background: 'rgba(255,255,255,0.07)',
      color: 'rgba(255,255,255,0.65)',
    },
  },
});

/* ─── Nav data ────────────────────────────────────────────────────────────── */
type NavItem = { label: string; href: string; Icon: React.FC<any> };

const OPS_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Dispatch',
    items: [
      { label: 'Dashboard',    href: '/dashboard',          Icon: GridRegular        },
      { label: 'New Incident', href: '/incidents/new',      Icon: AlertUrgentRegular },
      { label: 'Vehicle Map',  href: '/vehicles',           Icon: MapRegular         },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Analytics',    href: '/analytics',          Icon: DataBarVerticalRegular },
    ],
  },
  {
    section: 'Tools',
    items: [
      { label: 'Simulate',     href: '/dashboard/simulate', Icon: PlayCircleRegular      },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Organisations',href: '/admin/organizations',Icon: BuildingRegular    },
      { label: 'Users',        href: '/admin/users',        Icon: PeopleRegular      },
    ],
  },
];

const FLEET_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operations',
    items: [
      { label: 'Dashboard',    href: '/fleet/dashboard',    Icon: GridRegular        },
      { label: 'Vehicles',     href: '/fleet/vehicles',     Icon: VehicleCarRegular  },
      { label: 'Staff',        href: '/fleet/staff',        Icon: PeopleRegular      },
      { label: 'Capacity',     href: '/fleet/capacity',     Icon: HeartPulseRegular  },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Analytics',    href: '/fleet/analytics',    Icon: DataBarVerticalRegular },
    ],
  },
];

function navForRole(role: UserRole, orgType?: string | null) {
  if (role === 'system_admin') return OPS_NAV;
  if (role === 'org_admin') {
    return FLEET_NAV.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.href === '/fleet/capacity') return orgType === 'hospital';
        if (item.href === '/fleet/vehicles' || item.href === '/fleet/staff') return orgType !== 'hospital';
        return true;
      }),
    })).filter(g => g.items.length > 0);
  }
  return [];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function roleLabel(role: string, orgType?: string | null) {
  if (role === 'system_admin') return 'Operations Centre';
  if (orgType === 'hospital')       return 'Hospital Admin';
  if (orgType === 'ambulance_service') return 'Fleet Admin';
  if (orgType === 'police_station') return 'Police Admin';
  if (orgType === 'fire_station')   return 'Fire Admin';
  return role.replace(/_/g, ' ');
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export function Sidebar() {
  const styles = useStyles();
  const router = useRouter();
  const path   = usePathname();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const groups = navForRole(user.role, user.org_type);

  function isActive(href: string) {
    if (href === '/dashboard' || href === '/fleet/dashboard') return path === href;
    return path.startsWith(href);
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <nav className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandMark}>N</div>
        <div>
          <span className={styles.brandName}>NERDCO</span>
          <span className={styles.brandSub}>Emergency Dispatch</span>
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.nav}>
        {groups.map(group => (
          <div key={group.section}>
            <div className={styles.sectionLabel}>{group.section}</div>
            {group.items.map(({ label, href, Icon }) => {
              const active = isActive(href);
              return (
                <div
                  key={href}
                  className={mergeClasses(styles.item, active ? styles.activeItem : undefined)}
                  onClick={() => router.push(href)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && router.push(href)}
                >
                  <span className={mergeClasses(styles.iconWrap, active ? styles.activeIconWrap : undefined)}>
                    <Icon fontSize={15} />
                  </span>
                  {label}
                  {active && <span className={styles.activeIndicator} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.userRow} onClick={() => setProfileOpen(true)} style={{cursor: "pointer", transition: "background 150ms", borderRadius: "5px"}} onMouseEnter={e => e.currentTarget.style.background = "var(--color-bg)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div className={styles.avatar}>{initials(user.name)}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{roleLabel(user.role, user.org_type)}</span>
          </div>
        </div>
        <div className={styles.logoutBtn} onClick={handleLogout} role="button" tabIndex={0}>
          <SignOutRegular fontSize={14} />
          Sign out
        </div>
      </div>
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </nav>
  );
}
