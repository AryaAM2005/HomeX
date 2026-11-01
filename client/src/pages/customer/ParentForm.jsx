import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { MapPicker } from '../../components/Maps';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact } from '../../utils/validators';

const splitList = (text) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function ParentFields({ parent }) {
  const navigate = useNavigate();

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      name: parent?.name ?? '',
      age: parent?.age ? String(parent.age) : '',
      address: parent?.address ?? '',
      location: parent?.location ?? null,
      conditions: parent?.conditions.join(', ') ?? '',
      allergies: parent?.allergies.join(', ') ?? '',
      'emergencyContact.name': parent?.emergencyContact?.name ?? '',
      'emergencyContact.phone': parent?.emergencyContact?.phone ?? '',
      'emergencyContact.relation': parent?.emergencyContact?.relation ?? '',
    },
    validate: (form) => {
      const age = Number(form.age);

      return compact({
        name: form.name.trim().length < 2 ? "Enter your parent's name" : undefined,
        age: Number.isInteger(age) && age >= 40 && age <= 120 ? undefined : 'Enter an age of 40 or above',
        address: form.address.trim().length < 5 ? 'Enter the full address' : undefined,
        location: form.location ? undefined : 'Place a pin on the map',
        'emergencyContact.name':
          form['emergencyContact.name'].trim().length < 2 ? 'Enter a contact name' : undefined,
        'emergencyContact.phone': /^\+?\d{7,15}$/.test(
          form['emergencyContact.phone'].replace(/[\s()-]/g, ''),
        )
          ? undefined
          : 'Enter a valid phone number',
      });
    },
    onSubmit: async (form) => {
      const body = {
        name: form.name,
        age: Number(form.age),
        address: form.address,
        location: form.location,
        conditions: splitList(form.conditions),
        allergies: splitList(form.allergies),
        emergencyContact: {
          name: form['emergencyContact.name'],
          phone: form['emergencyContact.phone'],
          relation: form['emergencyContact.relation'],
        },
      };

      if (parent) await api.put(`/parents/${parent.id}`, body);
      else await api.post('/parents', body);

      navigate('/parents', {
        state: { notice: `${form.name}'s details have been saved.` },
      });
    },
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <FormAlert>{formError}</FormAlert>
      <FormField label="Full name" autoComplete="off" {...field('name')} />
      <FormField label="Age" inputMode="numeric" autoComplete="off" {...field('age')} />
      <FormTextarea label="Home address" rows={3} {...field('address')} />
      <MapPicker
        label="Pin their home on the map"
        hint="We use this to find caregivers nearby."
        value={values.location}
        error={errors.location}
        onChange={(location) => setValue('location', location)}
      />
      <FormField
        label="Health conditions (optional)"
        hint="Separate them with commas, like diabetes, high blood pressure"
        autoComplete="off"
        {...field('conditions')}
      />
      <FormField
        label="Allergies (optional)"
        hint="Separate them with commas"
        autoComplete="off"
        {...field('allergies')}
      />

      <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <legend className="px-1 font-semibold">Emergency contact</legend>
        <FormField label="Name" autoComplete="off" {...field('emergencyContact.name')} />
        <FormField
          label="Phone number"
          type="tel"
          autoComplete="off"
          {...field('emergencyContact.phone')}
        />
        <FormField
          label="Relation (optional)"
          autoComplete="off"
          {...field('emergencyContact.relation')}
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Saving…' : 'Save details'}
        </button>
        <Link to="/parents" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function EditParent({ id }) {
  const { data, loading, error, reload } = useApi(`/parents/${id}`);

  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={reload} />;
  return <ParentFields parent={data.parent} />;
}

export default function ParentForm() {
  const { id } = useParams();
  const title = id ? "Edit parent's details" : 'Add a parent';
  usePageTitle(title);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">{title}</h1>
      {id ? <EditParent id={id} /> : <ParentFields />}
    </div>
  );
}
