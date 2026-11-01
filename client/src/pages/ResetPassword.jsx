import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useForm } from '../hooks/useForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { compact, newPasswordError } from '../utils/validators';

export default function ResetPassword() {
  usePageTitle('Choose a new password');
  const { token } = useParams();
  const navigate = useNavigate();

  const { field, formError, submitting, handleSubmit } = useForm({
    initial: { password: '' },
    validate: ({ password }) => compact({ password: newPasswordError(password) }),
    onSubmit: async ({ password }) => {
      const res = await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { notice: res.data.message } });
    },
  });

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link to="/forgot-password" className="text-link">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          {...field('password')}
        />
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthCard>
  );
}
