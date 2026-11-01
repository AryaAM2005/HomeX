import { Link } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-4xl">We can't find that page</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or the link may be wrong.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Go to the home page
      </Link>
    </div>
  );
}
