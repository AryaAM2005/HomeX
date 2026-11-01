import { BadgeCheck, ShieldCheck, Star } from 'lucide-react';
import { apiUrl } from '../api/client';

export function CaregiverAvatar({ caregiver, size = 64 }) {
  if (caregiver.hasPhoto) {
    return (
      <img
        src={apiUrl(`/caregivers/${caregiver.id}/photo`)}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-clay font-display text-2xl font-semibold text-white"
    >
      {caregiver.name[0]}
    </span>
  );
}

export function TrustBadges({ policeVerified }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base font-medium text-leaf">
      <li className="flex items-center gap-1">
        <BadgeCheck aria-hidden="true" size={18} />
        Verified
      </li>
      {policeVerified && (
        <li className="flex items-center gap-1">
          <ShieldCheck aria-hidden="true" size={18} />
          Police checked
        </li>
      )}
    </ul>
  );
}

export function Rating({ ratingAvg, ratingCount }) {
  if (ratingCount === 0) return <span className="text-ink-soft">No ratings yet</span>;

  return (
    <span className="inline-flex items-center gap-1">
      <Star aria-hidden="true" size={18} className="fill-marigold text-marigold" />
      <strong>{ratingAvg.toFixed(1)}</strong>
      <span className="text-ink-soft">({ratingCount} ratings)</span>
    </span>
  );
}
