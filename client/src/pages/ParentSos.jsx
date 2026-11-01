import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { useParams } from 'react-router';
import { api } from '../api/client';
import { HELPLINE } from '../data/site';
import { useApi } from '../hooks/useApi';

// The parent may never log in, so this is one large button behind a private link.
export default function ParentSos() {
  const { token } = useParams();
  const { data, loading, error } = useApi(`/alerts/public/${token}`);
  const [state, setState] = useState('ready');

  useEffect(() => {
    document.title = 'SOS | HOMEX';
  }, []);

  const send = async () => {
    setState('sending');
    try {
      await api.post(`/alerts/public/${token}/sos`);
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  const callLink = (
    <a href={HELPLINE.href} className="btn btn-secondary min-h-16 text-xl">
      <Phone aria-hidden="true" size={24} />
      Call {HELPLINE.display}
    </a>
  );

  const body = () => {
    if (loading) return <p className="text-xl">Loading…</p>;
    if (error) {
      return (
        <>
          <h1 className="text-3xl">This link has stopped working</h1>
          <p className="text-xl">Please call the helpline for help.</p>
          {callLink}
        </>
      );
    }

    if (state === 'sent') {
      return (
        <>
          <h1 className="text-4xl">Help has been called</h1>
          <p role="alert" className="text-2xl">
            Your family and care manager have been told. Stay where you are if you can.
          </p>
          {callLink}
        </>
      );
    }

    return (
      <>
        <h1 className="text-3xl">Hello {data.name}</h1>
        <p className="text-2xl">Press the button if you need help.</p>
        <button
          type="button"
          onClick={send}
          disabled={state === 'sending'}
          className="grid size-64 place-items-center rounded-full bg-sos font-sans text-6xl font-bold text-white shadow-lg ring-8 ring-white disabled:opacity-80"
        >
          {state === 'sending' ? '…' : 'SOS'}
        </button>
        {state === 'failed' && (
          <p role="alert" className="text-2xl font-semibold text-danger">
            That did not work. Please call the number below.
          </p>
        )}
        {callLink}
      </>
    );
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-cream p-6 text-center">
      {body()}
    </main>
  );
}
