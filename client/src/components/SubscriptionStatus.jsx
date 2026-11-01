import { formatDate, formatMoney } from '../utils/format';

const BADGES = {
  trial: { label: 'Free trial', tone: 'bg-marigold text-ink' },
  active: { label: 'Active', tone: 'bg-leaf text-white' },
  cancelled: { label: 'Cancelled', tone: 'bg-sand text-ink' },
};

export function StatusBadge({ status }) {
  const { label, tone } = BADGES[status];

  return <span className={`rounded-full px-3 py-0.5 text-base font-semibold ${tone}`}>{label}</span>;
}

export function renewalText(subscription) {
  const { status, renewsAt, nextCharge, currency } = subscription;
  const date = formatDate(renewsAt);

  if (status === 'cancelled') return `Care ends on ${date}. You will not be charged again.`;

  const amount = formatMoney(nextCharge, currency);
  if (status === 'trial') return `Free until ${date}, then ${amount}.`;
  return `Renews on ${date} for ${amount}.`;
}
