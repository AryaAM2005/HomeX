// Parents live in India, so care days and dose times always run on India time,
// wherever the family viewing them happens to be.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toIst = (date) => new Date(date.getTime() + IST_OFFSET_MS);

export const istDate = (date = new Date()) => toIst(date).toISOString().slice(0, 10);

export const istTime = (date = new Date()) => toIst(date).toISOString().slice(11, 16);

export const istMonth = (date = new Date()) => istDate(date).slice(0, 7);

export function addIstMinutes(dateText, time, minutes) {
  return new Date(Date.parse(`${dateText}T${time}:00+05:30`) + minutes * 60 * 1000);
}

export const startOfIstDay = (dateText = istDate()) => addIstMinutes(dateText, '00:00', 0);

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const asUtcDay = (dateText) => new Date(`${dateText}T00:00:00Z`);

export const addDays = (dateText, days) =>
  new Date(asUtcDay(dateText).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export const mondayOf = (dateText) => addDays(dateText, -((asUtcDay(dateText).getUTCDay() + 6) % 7));

export const istWeekday = (date) => WEEKDAYS[asUtcDay(istDate(date)).getUTCDay()];
