import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate, formatMoney } from '../../utils/format';

export default function Refer() {
  usePageTitle('Refer & Earn');
  const { data, loading, error, reload } = useApi('/referrals');
  const [copied, setCopied] = useState(false);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const reward = formatMoney(data.creditPerReferral, 'INR');
    const link = `${window.location.origin}/plans?code=${data.referralCode}`;
    const message = `I use HOMEX to look after my parents. Use my code ${data.referralCode} and we each get ${reward} credit: ${link}`;

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        window.prompt('Copy your link:', link);
      }
    };

    return (
      <>
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <p className="text-ink-soft">Your referral code</p>
          <p className="mt-1 font-display text-4xl font-semibold break-all">{data.referralCode}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <MessageCircle aria-hidden="true" size={20} />
              Share on WhatsApp
            </a>
            <button type="button" onClick={copyLink} className="btn btn-secondary">
              <Copy aria-hidden="true" size={20} />
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>

        <p className="mt-6 rounded-xl bg-sand px-4 py-3">
          <strong>Credit balance: {formatMoney(data.credit, 'INR')}.</strong> Credit is used
          automatically on your next payment.
        </p>

        <h2 className="mt-10 text-3xl">Families you have referred</h2>
        {data.referrals.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nobody yet. Share your code to get started.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {data.referrals.map((referral) => (
              <li key={referral.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  <strong>{referral.name}</strong>, joined {formatDate(referral.date)}
                </span>
                <span className={referral.status === 'credited' ? 'font-medium text-leaf' : 'text-ink-soft'}>
                  {referral.status === 'credited' ? `${reward} credited` : 'Waiting for first payment'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Refer &amp; Earn</h1>
      <p className="mt-2 text-ink-soft">
        When a family you refer makes their first payment, you each get Rs. 500 credit.
      </p>
      {content()}
    </div>
  );
}
