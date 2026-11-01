export default function LoadError({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-white p-6 text-center">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-secondary mt-4">
        Try again
      </button>
    </div>
  );
}
