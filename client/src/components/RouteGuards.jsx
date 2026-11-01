import { Navigate, Outlet, useLocation } from 'react-router';
import { ROLE_HOME, useAuth } from '../context/useAuth';
import Loading from './Loading';
import RoleNav from './RoleNav';

export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  // Leaving out the role opens a page to everyone who is signed in.
  if (role && user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return (
    <>
      <RoleNav />
      <Outlet />
    </>
  );
}

// Login and sign-up pages send people who are already signed in to their dashboard.
export function GuestRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (user) return <Navigate to={location.state?.from ?? ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
