export default function FormAlert({ tone = 'error', children }) {
  if (!children) return null;

  const tones = {
    error: 'border-danger text-danger',
    success: 'border-leaf text-leaf',
  };

  return (
    <p role="alert" className={`rounded-xl border-2 bg-white px-4 py-3 font-medium ${tones[tone]}`}>
      {children}
    </p>
  );
}
