import { useRef, useState } from 'react';
import { Phone, Siren } from 'lucide-react';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/useAuth';
import { HELPLINE } from '../data/site';
import FormAlert from './FormAlert';

const PARENT_SOURCES = {
  customer: { url: '/parents', pick: (data) => data.parents },
  caregiver: { url: '/checkins/today', pick: (data) => data.visits },
};

export default function SosButton() {
  const { user } = useAuth();
  const dialog = useRef(null);
  const [parents, setParents] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;

  const source = PARENT_SOURCES[user.role];

  const open = async () => {
    setSentTo('');
    setError('');
    dialog.current.showModal();

    if (source) {
      try {
        const res = await api.get(source.url);
        setParents(source.pick(res.data));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }
  };

  const raise = async (parent) => {
    setBusyId(parent.id);
    setError('');
    try {
      await api.post('/alerts/sos', { parentId: parent.id });
      setSentTo(parent.name);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="fixed bottom-4 right-4 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-sos px-6 text-lg font-bold text-white shadow-lg ring-2 ring-white hover:brightness-90"
      >
        <Siren aria-hidden="true" size={22} />
        SOS
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="sos-title"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-cream p-6 text-ink backdrop:bg-ink/60"
      >
        <h2 id="sos-title" className="text-3xl">
          Emergency
        </h2>

        {sentTo ? (
          <p role="alert" className="mt-3 rounded-xl border-2 border-leaf bg-white px-4 py-3 font-medium">
            Alert sent for {sentTo}. The family and care manager have been told.
          </p>
        ) : (
          <>
            <p className="mt-2 text-ink-soft">
              {source
                ? 'This immediately alerts the family and care manager.'
                : 'Call the helpline for urgent help.'}
            </p>
            <div className="mt-4 grid gap-3">
              {parents.map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => raise(parent)}
                  className="btn bg-sos text-white disabled:opacity-70"
                >
                  {busyId === parent.id ? 'Sending…' : `Raise SOS for ${parent.name}`}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-3">
          <FormAlert>{error}</FormAlert>
        </div>

        <div className="mt-3 grid gap-3">
          <a href={HELPLINE.href} className="btn btn-secondary">
            <Phone aria-hidden="true" size={20} />
            Call helpline {HELPLINE.display}
          </a>
          <button type="button" onClick={() => dialog.current.close()} className="btn">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
