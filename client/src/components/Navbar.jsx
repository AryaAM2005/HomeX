import { useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ROLE_HOME, useAuth } from '../context/useAuth';
import { HELPLINE } from '../data/site';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

const publicLinks = [
  { to: '/plans', label: 'Plans & Pricing' },
  { to: '/nri-families', label: 'For NRI Families' },
  { to: '/employers', label: 'For Employers' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

function navLinkClass({ isActive }) {
  return `font-medium underline-offset-8 hover:underline ${isActive ? 'text-clay underline' : ''}`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openedAt, setOpenedAt] = useState(null);

  // Tied to the current path, so following any link closes the mobile menu.
  const menuOpen = openedAt === pathname;

  const handleLogout = async () => {
    await logout().catch(() => {});
    navigate('/login', { replace: true });
  };

  const accountActions = user ? (
    <>
      <Link to={ROLE_HOME[user.role]} className="btn btn-primary">
        Dashboard
      </Link>
      <button type="button" onClick={handleLogout} className="btn btn-secondary">
        Log out
      </button>
    </>
  ) : (
    <>
      <Link to="/login" className="btn btn-secondary">
        Log in
      </Link>
      <Link to="/signup" className="btn btn-primary">
        Sign up
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-20">
      <div className="bg-ink text-cream">
        <a
          href={HELPLINE.href}
          className="mx-auto flex min-h-10 max-w-6xl items-center justify-center gap-2 px-4 text-base md:justify-end"
        >
          <Phone aria-hidden="true" size={16} />
          <span>
            24/7 helpline: <strong className="whitespace-nowrap">{HELPLINE.display}</strong>
          </span>
        </a>
      </div>

      <nav aria-label="Main" className="border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex min-h-18 items-center justify-between gap-4">
            <Logo />

            <ul className="hidden items-center gap-6 xl:flex">
              {publicLinks.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={navLinkClass}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-1 xl:gap-3">
              {user && <NotificationBell />}
              <div className="hidden items-center gap-3 xl:flex">{accountActions}</div>

              <button
                type="button"
                onClick={() => setOpenedAt(menuOpen ? null : pathname)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="grid size-12 place-items-center rounded-lg xl:hidden"
              >
                {menuOpen ? <X aria-hidden="true" size={28} /> : <Menu aria-hidden="true" size={28} />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div id="mobile-menu" className="border-t border-line py-4 xl:hidden">
              <ul className="space-y-1">
                {publicLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} className={(state) => `block py-2 ${navLinkClass(state)}`}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-3">{accountActions}</div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
