import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { api, getErrorMessage } from '../api/client';
import FormAlert from './FormAlert';

export default function ParentSosLink({ parent }) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const url = `/parents/${parent.id}/sos-link`;

  const load = async (request) => {
    setError('');
    setCopied(false);
    try {
      const res = await request;
      setLink(`${window.location.origin}/sos/${res.data.token}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  if (!link) {
    return (
      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
        <button type="button" onClick={() => load(api.get(url))} className="text-link">
          Set up {parent.name}'s SOS page
        </button>
      </div>
    );
  }

  const message = `This is your HOMEX SOS page. Save it to your home screen and press the big button if you need help: ${link}`;

  return (
    <div className="mt-3 rounded-xl bg-sand p-4">
      <p className="font-semibold">{parent.name}'s SOS page</p>
      <p className="text-ink-soft">
        One big button, with no login. Anyone with this link can raise an alert, so share it only
        with {parent.name}.
      </p>
      <p className="mt-2 break-all rounded-lg bg-white px-3 py-2">{link}</p>
      <div className="mt-2">
        <FormAlert>{error}</FormAlert>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="btn btn-secondary">
          <Copy aria-hidden="true" size={20} />
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary"
        >
          <MessageCircle aria-hidden="true" size={20} />
          Share on WhatsApp
        </a>
        <button type="button" onClick={() => load(api.post(url))} className="btn text-danger underline">
          Replace link
        </button>
      </div>
    </div>
  );
}
