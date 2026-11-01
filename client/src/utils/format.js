export function formatMoney(amount, currency) {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' && !Number.isInteger(amount) ? 2 : 0,
  }).format(amount);
}

// No time zone is set, so dates appear in the viewer's own time zone.
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(date));
}

// Care days run on India time, wherever the viewer is.
const indiaDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

export const indiaDate = (date = new Date()) => indiaDayFormat.format(date);

export function detectCurrency(user) {
  if (user) return user.country === 'IN' ? 'INR' : 'USD';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta' ? 'INR' : 'USD';
}
