import { Link, useLocation } from 'react-router';
import AuthCard from '../components/AuthCard';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useAuth } from '../context/useAuth';
import { useForm } from '../hooks/useForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { compact, emailError } from '../utils/validators';

export default function Login() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const { state } = useLocation();

  const { field, formError, submitting, handleSubmit } = useForm({
    initial: { email: '', password: '' },
    validate: ({ email, password }) =>
      compact({
        email: emailError(email),
        password: password ? undefined : 'Enter your password',
      }),
    // GuestRoute moves the user to their dashboard as soon as they are signed in.
    onSubmit: login,
  });

  return (
    <AuthCard
      title="Welcome back"
      intro="Log in to see how your parents are doing."
      footer={
        <>
          New to HOMEX?{' '}
          <Link to="/signup" state={state} className="text-link">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormAlert tone="success">{state?.notice}</FormAlert>
        <FormAlert>{formError}</FormAlert>
        <FormField label="Email" type="email" autoComplete="email" {...field('email')} />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          {...field('password')}
        />
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-center">
          <Link to="/forgot-password" className="text-link">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
