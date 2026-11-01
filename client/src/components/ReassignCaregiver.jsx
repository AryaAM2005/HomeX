import { useState } from 'react';
import { api, getErrorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import FormAlert from './FormAlert';
import LoadError from './LoadError';
import Toggle from './Toggle';

const TYPE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'backup', label: 'Backup' },
];

export default function ReassignCaregiver({ parent, onChanged }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(parent.backupCaregiver ? 'primary' : 'backup');
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams({ ...parent.location, radius: '25' });
  const nearby = useApi(open ? `/caregivers/nearby?${query}` : '/plans');

  if (!parent.location) {
    return <p className="mt-3 text-ink-soft">This parent has no map pin yet.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary mt-3">
        Change caregiver
      </button>
    );
  }

  const assignedIds = [parent.primaryCaregiver?.id, parent.backupCaregiver?.id];
  const options = (nearby.data?.caregivers ?? []).filter(({ id }) => !assignedIds.includes(id));
  const caregiverId = chosen || options[0]?.id || '';

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/parents/${parent.id}/assign`, { caregiverId, type });
      setOpen(false);
      setChosen('');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-sand p-4">
      <FormAlert>{error}</FormAlert>
      <Toggle legend="Caregiver to change" value={type} onChange={setType} options={TYPE_OPTIONS} />

      {nearby.error ? (
        <LoadError message={nearby.error} onRetry={nearby.reload} />
      ) : (
        <div>
          <label htmlFor="new-caregiver" className="block font-semibold">
            New {type} caregiver
          </label>
          <select
            id="new-caregiver"
            value={caregiverId}
            onChange={(event) => setChosen(event.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
          >
            {options.length === 0 && <option value="">Nobody else is nearby</option>}
            {options.map(({ id, name, distanceKm }) => (
              <option key={id} value={id}>
                {name}, {distanceKm} km away
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-ink-soft">This applies straight away. Speak to the caregiver first.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !caregiverId} className="btn btn-primary">
          Save change
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Go back
        </button>
      </div>
    </form>
  );
}
