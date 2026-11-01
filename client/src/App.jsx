import { createBrowserRouter, RouterProvider } from 'react-router';
import Layout from './components/Layout';
import { GuestRoute, ProtectedRoute } from './components/RouteGuards';
import About from './pages/About';
import AdminBookings from './pages/admin/Bookings';
import AdminCareManagers from './pages/admin/CareManagers';
import CaregiverReview from './pages/admin/CaregiverReview';
import AdminComplaints from './pages/admin/Complaints';
import AdminDashboard from './pages/admin/Dashboard';
import AdminEmployerCodes from './pages/admin/EmployerCodes';
import AdminPlans from './pages/admin/Plans';
import AdminUsers from './pages/admin/Users';
import AdminVerification from './pages/admin/Verification';
import AlertsPage from './pages/AlertsPage';
import CaregiverAvailability from './pages/caregiver/Availability';
import CaregiverBookings from './pages/caregiver/Bookings';
import CaregiverDashboard from './pages/caregiver/Dashboard';
import Earnings from './pages/caregiver/Earnings';
import LogCheckIn from './pages/caregiver/LogCheckIn';
import CaregiverProfilePage from './pages/caregiver/Profile';
import CaregiverRequests from './pages/caregiver/Requests';
import SubmitReport from './pages/caregiver/SubmitReport';
import CareManagerDashboard from './pages/careManager/Dashboard';
import ParentDetail from './pages/careManager/ParentDetail';
import Contact from './pages/Contact';
import Billing from './pages/customer/Billing';
import Bookings from './pages/customer/Bookings';
import BookService from './pages/customer/BookService';
import CaregiverProfile from './pages/customer/CaregiverProfile';
import CheckIns from './pages/customer/CheckIns';
import Checkout from './pages/customer/Checkout';
import ChooseCaregiver from './pages/customer/ChooseCaregiver';
import CustomerDashboard from './pages/customer/Dashboard';
import ParentForm from './pages/customer/ParentForm';
import Parents from './pages/customer/Parents';
import Refer from './pages/customer/Refer';
import Reports from './pages/customer/Reports';
import Employers from './pages/Employers';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Login from './pages/Login';
import MedicinesPage from './pages/MedicinesPage';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';
import NriFamilies from './pages/NriFamilies';
import ParentSos from './pages/ParentSos';
import Plans from './pages/Plans';
import Privacy from './pages/Privacy';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import Signup from './pages/Signup';

const router = createBrowserRouter([
  { path: '/sos/:token', element: <ParentSos /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/plans', element: <Plans /> },
      { path: '/nri-families', element: <NriFamilies /> },
      { path: '/employers', element: <Employers /> },
      { path: '/about', element: <About /> },
      { path: '/contact', element: <Contact /> },
      { path: '/privacy', element: <Privacy /> },
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/signup', element: <Signup /> },
          { path: '/forgot-password', element: <ForgotPassword /> },
          { path: '/reset-password/:token', element: <ResetPassword /> },
        ],
      },
      {
        element: <ProtectedRoute role="customer" />,
        children: [
          { path: '/dashboard', element: <CustomerDashboard /> },
          { path: '/parents', element: <Parents /> },
          { path: '/parents/new', element: <ParentForm /> },
          { path: '/parents/:id/edit', element: <ParentForm /> },
          { path: '/parents/:id/caregivers', element: <ChooseCaregiver /> },
          { path: '/parents/:id/checkins', element: <CheckIns /> },
          { path: '/parents/:id/medicines', element: <MedicinesPage /> },
          { path: '/parents/:id/book', element: <BookService /> },
          { path: '/parents/:id/reports', element: <Reports /> },
          { path: '/bookings', element: <Bookings /> },
          { path: '/caregivers/:id', element: <CaregiverProfile /> },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/subscribe/:planId', element: <Checkout /> },
          { path: '/billing', element: <Billing /> },
          { path: '/refer', element: <Refer /> },
        ],
      },
      {
        element: <ProtectedRoute role="caregiver" />,
        children: [
          { path: '/caregiver', element: <CaregiverDashboard /> },
          { path: '/caregiver/checkin/:id', element: <LogCheckIn /> },
          { path: '/caregiver/medicines/:id', element: <MedicinesPage /> },
          { path: '/caregiver/bookings', element: <CaregiverBookings /> },
          { path: '/caregiver/bookings/:id/report', element: <SubmitReport /> },
          { path: '/caregiver/earnings', element: <Earnings /> },
          { path: '/caregiver/requests', element: <CaregiverRequests /> },
          { path: '/caregiver/availability', element: <CaregiverAvailability /> },
          { path: '/caregiver/profile', element: <CaregiverProfilePage /> },
        ],
      },
      {
        element: <ProtectedRoute role="careManager" />,
        children: [
          { path: '/care-manager', element: <CareManagerDashboard /> },
          { path: '/care-manager/alerts', element: <AlertsPage /> },
          { path: '/care-manager/parents/:id', element: <ParentDetail /> },
        ],
      },
      {
        element: <ProtectedRoute role="admin" />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/admin/alerts', element: <AlertsPage /> },
          { path: '/admin/users', element: <AdminUsers /> },
          { path: '/admin/care-managers', element: <AdminCareManagers /> },
          { path: '/admin/bookings', element: <AdminBookings /> },
          { path: '/admin/complaints', element: <AdminComplaints /> },
          { path: '/admin/caregivers', element: <AdminVerification /> },
          { path: '/admin/caregivers/:id', element: <CaregiverReview /> },
          { path: '/admin/plans', element: <AdminPlans /> },
          { path: '/admin/employer-codes', element: <AdminEmployerCodes /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/notifications', element: <Notifications /> },
          { path: '/settings', element: <Settings /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
