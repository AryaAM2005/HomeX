import { HeartHandshake, UsersRound } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import AuthCard from '../components/AuthCard';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useAuth } from '../context/useAuth';
import { COUNTRIES } from '../data/site';
import { useForm } from '../hooks/useForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { compact, emailError, newPasswordError, phoneError } from '../utils/validators';

const ROLE_OPTIONS = [
  {
    value: 'customer',
    title: 'I am caring for a parent',
    description: 'Subscribe and pick a caregiver near your parent.',
    Icon: UsersRound,
  },
  {
    value: 'caregiver',
    title: 'I am a caregiver',
    description: 'Get verified and start caring for families nearby.',
    Icon: HeartHandshake,
  },
];

export default function Signup() {
  usePageTitle('Sign up');
  const { register } = useAuth();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      role: searchParams.get('role') === 'caregiver' ? 'caregiver' : 'customer',
      name: '',
      email: '',
      phone: '',
      country: 'IN',
      password: '',
      consent: false,
    },
    validate: ({ name, email, phone, country, password, consent }) =>
      compact({
        name: name.trim().length < 2 ? 'Enter your full name' : undefined,
        email: emailError(email),
        phone: phoneError(phone, country),
        password: newPasswordError(password),
        consent: consent ? undefined : 'Please give your consent to continue',
      }),
    onSubmit: (details) =>
      // GuestRoute moves the user to their dashboard as soon as they are signed in.
      register({
        ...details,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
  });

  const chooseRole = (role) => {
    setValue('role', role);
    if (role === 'caregiver') setValue('country', 'IN');
  };

  return (
    <AuthCard
      title="Create your account"
      intro="It takes about two minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={state} className="text-link">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>

        <fieldset>
          <legend className="font-semibold">How will you use HOMEX?</legend>
          <div className="mt-2 grid gap-3">
            {ROLE_OPTIONS.map(({ value, title, description, Icon }) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 bg-white p-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay ${
                  values.role === value ? 'border-clay' : 'border-line hover:border-ink-soft'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={values.role === value}
                  onChange={() => chooseRole(value)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" size={28} className="mt-0.5 shrink-0 text-clay" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-base text-ink-soft">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormField label="Full name" autoComplete="name" {...field('name')} />
        <FormField label="Email" type="email" autoComplete="email" {...field('email')} />

        {values.role === 'customer' && (
          <div>
            <label htmlFor="country" className="block font-semibold">
              Where do you live?
            </label>
            <select
              id="country"
              name="country"
              value={values.country}
              onChange={(event) => setValue('country', event.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2 hover:border-ink-soft"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <FormField
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          hint={values.country === 'IN' ? undefined : 'Include your country code'}
          {...field('phone')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          {...field('password')}
        />

        <div>
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              name="consent"
              checked={values.consent}
              onChange={(event) => setValue('consent', event.target.checked)}
              aria-invalid={errors.consent ? 'true' : undefined}
              aria-describedby={errors.consent ? 'consent-error' : undefined}
              className="mt-1 size-5 shrink-0 accent-clay"
            />
            <span>
              I consent to HOMEX using my personal details, and the health details I add for my
              parent, to provide care, as set out in the{' '}
              <Link to="/privacy" target="_blank" className="text-link">
                privacy notice
              </Link>
              .
            </span>
          </label>
          {errors.consent && (
            <p id="consent-error" className="mt-1.5 text-base font-medium text-danger">
              {errors.consent}
            </p>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
