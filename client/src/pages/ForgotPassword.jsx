import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useForm } from '../hooks/useForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { compact, emailError } from '../utils/validators';

export default function ForgotPassword() {
  usePageTitle('Forgot password');
  const [sentMessage, setSentMessage] = useState('');

  const { field, formError, submitting, handleSubmit } = useForm({
    initial: { email: '' },
    validate: ({ email }) => compact({ email: emailError(email) }),
    onSubmit: async (values) => {
      const res = await api.post('/auth/forgot-password', values);
      setSentMessage(res.data.message);
    },
  });

  return (
    <AuthCard
      title="Forgot your password?"
      intro="Enter your email and we will send you a link to choose a new one."
      footer={
        <Link to="/login" className="text-link">
          Back to log in
        </Link>
      }
    >
      {sentMessage ? (
        <FormAlert tone="success">{sentMessage}</FormAlert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormAlert>{formError}</FormAlert>
          <FormField label="Email" type="email" autoComplete="email" {...field('email')} />
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
