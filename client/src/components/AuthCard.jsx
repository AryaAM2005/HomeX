export default function AuthCard({ title, intro, children, footer }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-ink-soft">{intro}</p>}
      <div className="mt-8">{children}</div>
      {footer && <p className="mt-8 text-center">{footer}</p>}
    </div>
  );
}
