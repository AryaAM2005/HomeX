import { Outlet, ScrollRestoration } from 'react-router';
import ErrorBoundary from './ErrorBoundary';
import Footer from './Footer';
import LiveAlertBanner from './LiveAlertBanner';
import Navbar from './Navbar';
import SosButton from './SosButton';

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="absolute left-4 top-2 z-30 -translate-y-20 rounded-lg bg-ink px-4 py-2 text-cream focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Navbar />
      <LiveAlertBanner />
      <main id="main" className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <SosButton />
      <ScrollRestoration />
    </div>
  );
}
