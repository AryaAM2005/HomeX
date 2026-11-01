import { useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact } from '../../utils/validators';

const EMPTY_FORM = { code: '', company: '', employeeCount: '' };

function CreateCodeForm({ onCreated }) {
  const { values, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: EMPTY_FORM,
    validate: ({ code, company, employeeCount }) =>
      compact({
        code: /^[A-Za-z0-9]{4,20}$/.test(code.trim()) ? undefined : 'Use 4 to 20 letters and numbers',
        company: company.trim().length >= 2 ? undefined : 'Enter the company name',
        employeeCount:
          Number.isInteger(Number(employeeCount)) && Number(employeeCount) >= 10
            ? undefined
            : 'Employer codes need at least 10 employees',
      }),
    onSubmit: async (form) => {
      await api.post('/admin/employer-codes', { ...form, employeeCount: Number(form.employeeCount) });
      Object.entries(EMPTY_FORM).forEach(([name, value]) => setValue(name, value));
      onCreated();
    },
  });

  const employees = Number(values.employeeCount);

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-2xl">Create a code</h2>
      <FormAlert>{formError}</FormAlert>
      <FormField label="Code" autoComplete="off" {...field('code')} />
      <FormField label="Company" autoComplete="off" {...field('company')} />
      <FormField
        label="Number of employees"
        inputMode="numeric"
        hint="10+ employees get 10% off, and 50+ get 20% off."
        {...field('employeeCount')}
      />
      {employees >= 10 && (
        <p className="font-medium text-leaf">This code gives {employees >= 50 ? 20 : 10}% off.</p>
      )}
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Creating…' : 'Create code'}
      </button>
    </form>
  );
}

function CodeRow({ employerCode, onChanged, onError }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    onError('');
    try {
      await api.patch(`/admin/employer-codes/${employerCode.id}`, { active: !employerCode.active });
      onChanged();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="font-semibold break-all">{employerCode.code}</p>
        <p className="text-ink-soft">
          {employerCode.company}, {employerCode.employeeCount} employees, {employerCode.discountPct}% off
          {employerCode.active ? '' : ' (turned off)'}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={toggle} className="btn btn-secondary">
        {employerCode.active ? 'Turn off' : 'Turn on'}
      </button>
    </li>
  );
}

export default function AdminEmployerCodes() {
  usePageTitle('Employer Codes');
  const { data, loading, error, reload } = useApi('/admin/employer-codes');
  const [rowError, setRowError] = useState('');

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.employerCodes.length === 0) {
      return <p className="mt-3 text-ink-soft">No codes yet.</p>;
    }

    return (
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {data.employerCodes.map((employerCode) => (
          <CodeRow
            key={employerCode.id}
            employerCode={employerCode}
            onChanged={reload}
            onError={setRowError}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Employer Codes</h1>
      <p className="mt-2 text-ink-soft">
        Turning a code off stops new sign-ups. Families already using it keep their discount.
      </p>
      <CreateCodeForm onCreated={reload} />

      <h2 className="mt-10 text-3xl">All codes</h2>
      <div className="mt-3">
        <FormAlert>{rowError}</FormAlert>
      </div>
      {list()}
    </div>
  );
}
