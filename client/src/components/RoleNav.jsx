import { NavLink } from 'react-router';
import { useAuth } from '../context/useAuth';

const LINKS = {
  customer: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/parents', label: 'My Parents' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/billing', label: 'Billing' },
    { to: '/refer', label: 'Refer & Earn' },
    { to: '/settings', label: 'Settings' },
  ],
  caregiver: [
    { to: '/caregiver', label: 'Today', end: true },
    { to: '/caregiver/bookings', label: 'Bookings' },
    { to: '/caregiver/requests', label: 'Families' },
    { to: '/caregiver/earnings', label: 'Earnings' },
    { to: '/caregiver/availability', label: 'Availability' },
    { to: '/caregiver/profile', label: 'Profile' },
    { to: '/settings', label: 'Settings' },
  ],
  careManager: [
    { to: '/care-manager', label: 'My Families', end: true },
    { to: '/care-manager/alerts', label: 'Live Alerts' },
    { to: '/settings', label: 'Settings' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/alerts', label: 'Escalations' },
    { to: '/admin/caregivers', label: 'Verification' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/care-managers', label: 'Care Managers' },
    { to: '/admin/plans', label: 'Plans' },
    { to: '/admin/employer-codes', label: 'Employer Codes' },
    { to: '/admin/bookings', label: 'Bookings' },
    { to: '/admin/complaints', label: 'Complaints' },
  ],
};

export default function RoleNav() {
  const { user } = useAuth();
  const links = LINKS[user.role];
  if (!links) return null;

  return (
    <nav aria-label="Account" className="border-b border-line bg-white">
      <ul className="mx-auto flex max-w-6xl flex-wrap gap-x-5 px-4">
        {links.map((link) => (
          <li key={link.to} className="shrink-0">
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `inline-block border-b-3 py-3 font-medium ${
                  isActive ? 'border-clay text-clay' : 'border-transparent hover:border-line'
                }`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
