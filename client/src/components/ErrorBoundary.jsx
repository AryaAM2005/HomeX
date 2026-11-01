import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="mt-3 text-ink-soft">Please reload the page. Your data is safe.</p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-6">
          Reload page
        </button>
      </div>
    );
  }
}
