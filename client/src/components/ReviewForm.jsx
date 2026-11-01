import { useState } from 'react';
import { Star } from 'lucide-react';
import { api, getErrorMessage, getFieldErrors } from '../api/client';
import FormAlert from './FormAlert';
import FormTextarea from './FormTextarea';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewForm({ caregiverId, caregiverName, bookingId, onDone }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        Rate {caregiverName}
      </button>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (rating === 0) {
      setError('Choose a rating');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.post('/reviews', { caregiverId, bookingId, rating, comment });
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setError(fields.comment ?? fields.rating ?? getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-xl bg-sand p-4">
      <fieldset>
        <legend className="font-semibold">How was {caregiverName}?</legend>
        <div className="mt-1 flex gap-1">
          {STARS.map((value) => (
            <label
              key={value}
              className="grid size-11 cursor-pointer place-items-center rounded-lg has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay"
            >
              <input
                type="radio"
                name={`rating-${caregiverId}-${bookingId ?? 'month'}`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                aria-label={`${value} out of 5`}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                size={30}
                className={value <= rating ? 'fill-marigold text-marigold' : 'text-ink-soft'}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <FormTextarea
        label="A few words (optional)"
        rows={2}
        name="comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          Send rating
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Not now
        </button>
      </div>
    </form>
  );
}
