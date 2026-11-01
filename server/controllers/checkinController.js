import { detectFileType } from '../middleware/upload.js';
import { CheckIn } from '../models/CheckIn.js';
import { Medicine } from '../models/Medicine.js';
import { Parent } from '../models/Parent.js';
import { fromPoint, toPoint } from '../models/point.js';
import { User } from '../models/User.js';
import { emitToUsers } from '../utils/live.js';
import { raiseAlert } from '../utils/alerts.js';
import { ApiError } from '../utils/ApiError.js';
import { distanceKm } from '../utils/geo.js';
import { notify } from '../utils/notifications.js';
import { findParentFor } from '../utils/parentAccess.js';
import { saveFile, sendFile } from '../utils/storage.js';
import { istDate, istMonth } from '../utils/time.js';
import { findAbnormalVitals } from '../utils/vitals.js';
import { getLoggedDoses } from './medicineController.js';

const MAX_MONTH_RESULTS = 200;
const TREND_DAYS = 30;

function toPublicCheckIn(checkIn, caregiverName) {
  return {
    id: checkIn.id,
    type: checkIn.type,
    time: checkIn.time,
    date: checkIn.date,
    caregiverName,
    hasPhoto: Boolean(checkIn.photo?.file),
    location: fromPoint(checkIn.location),
    distanceFromHomeM: checkIn.distanceFromHomeM ?? null,
    mood: checkIn.mood,
    vitals: checkIn.vitals ?? {},
    medicines: checkIn.medicinesGiven.map(({ name, time, status }) => ({ name, time, status })),
    notes: checkIn.notes ?? '',
  };
}

async function resolveDoses(parentId, doses, date) {
  if (doses.length === 0) return [];

  const medicines = await Medicine.find({ parentId });
  const logged = await getLoggedDoses(parentId, date);
  const resolved = [];

  for (const { medicineId, time, status } of doses) {
    const medicine = medicines.find(({ id }) => id === medicineId);
    if (!medicine || !medicine.isActiveOn(date) || !medicine.times.includes(time)) {
      throw new ApiError(400, 'That medicine is not due today');
    }
    // A dose already logged earlier today keeps its first answer.
    if (!logged.has(`${medicineId}:${time}`)) {
      resolved.push({ medicineId, name: medicine.name, time, status });
    }
  }
  return resolved;
}

async function savePhoto(file) {
  const fileType = detectFileType(file.buffer);
  if (!fileType || fileType.mime === 'application/pdf') {
    throw new ApiError(400, 'Upload a JPG or PNG photo');
  }
  return { file: await saveFile(file.buffer, fileType.extension), mime: fileType.mime };
}

export async function logCheckIn(req, res) {
  const { parentId, type, location, mood, vitals, medicines, notes } = req.body;
  const parent = await findParentFor(req.user, parentId);

  if (type === 'visit' && !req.file) {
    throw new ApiError(400, 'Add a photo to log a visit', { photo: 'Add a photo to log a visit' });
  }

  const now = new Date();
  const date = istDate(now);
  const medicinesGiven = await resolveDoses(parent.id, medicines, date);
  const home = fromPoint(parent.location);

  const checkIn = await CheckIn.create({
    parentId: parent.id,
    caregiverId: req.user.id,
    type,
    time: now,
    date,
    location: location && toPoint(location),
    distanceFromHomeM: location && home ? Math.round(distanceKm(home, location) * 1000) : undefined,
    photo: req.file ? await savePhoto(req.file) : undefined,
    mood,
    vitals,
    medicinesGiven,
    notes,
  });

  const payload = toPublicCheckIn(checkIn, req.user.name);
  await emitToUsers(
    [parent.customerId, parent.careManagerId].filter(Boolean),
    'checkin:new',
    { ...payload, parent: { id: parent.id, name: parent.name } },
  );
  await notify(parent.customerId, {
    title: 'Check-in logged',
    body: `${req.user.name} checked in on ${parent.name}.`,
    link: `/parents/${parent.id}/checkins`,
  });

  const abnormal = findAbnormalVitals(vitals);
  if (abnormal.length > 0) {
    await raiseAlert({
      parent,
      type: 'abnormal_vitals',
      message: abnormal.join(', '),
      raisedBy: req.user.id,
      raisedVia: 'caregiver',
      dedupeKey: `abnormal_vitals:${checkIn.id}`,
    });
  }

  await Promise.all(
    medicinesGiven
      .filter(({ status }) => status === 'missed')
      .map(({ medicineId, name, time }) =>
        raiseAlert({
          parent,
          type: 'missed_medicine',
          message: `${name} at ${time} India time was missed`,
          raisedBy: req.user.id,
          raisedVia: 'caregiver',
          dedupeKey: `missed_medicine:${medicineId}:${date}:${time}`,
        }),
      ),
  );

  res.status(201).json({ checkIn: payload, abnormalVitals: abnormal });
}

function adherence(checkIns) {
  const doses = checkIns.flatMap(({ medicinesGiven }) => medicinesGiven);
  if (doses.length === 0) return null;

  const given = doses.filter(({ status }) => status === 'given').length;
  return Math.round((given / doses.length) * 100);
}

export async function listCheckIns(req, res) {
  const parent = await findParentFor(req.user, req.params.id);
  const month = req.validQuery.month ?? istMonth();

  const [checkIns, latest, recent] = await Promise.all([
    CheckIn.find({ parentId: parent.id, date: { $gte: `${month}-01`, $lte: `${month}-31` } })
      .sort({ time: -1 })
      .limit(MAX_MONTH_RESULTS),
    CheckIn.findOne({ parentId: parent.id }).sort({ time: -1 }),
    // Trends run across month ends, so a new month never starts with an empty chart.
    CheckIn.find(
      { parentId: parent.id, time: { $gte: new Date(Date.now() - TREND_DAYS * 86_400_000) } },
      'time vitals',
    ).sort({ time: -1 }),
  ]);

  const caregiverIds = [...new Set([...checkIns, latest].filter(Boolean).map((c) => String(c.caregiverId)))];
  const caregivers = await User.find({ _id: { $in: caregiverIds } }, 'name');
  const nameOf = (checkIn) =>
    caregivers.find(({ id }) => id === String(checkIn.caregiverId))?.name ?? 'Caregiver';

  res.json({
    parent: { id: parent.id, name: parent.name },
    month,
    checkIns: checkIns.map((checkIn) => toPublicCheckIn(checkIn, nameOf(checkIn))),
    latest: latest ? toPublicCheckIn(latest, nameOf(latest)) : null,
    recentVitals: recent.map(({ time, vitals }) => ({ time, vitals: vitals ?? {} })),
    adherencePct: adherence(checkIns),
  });
}

export async function listTodaysVisits(req, res) {
  const families = await Parent.find({
    $or: [{ primaryCaregiverId: req.user.id }, { backupCaregiverId: req.user.id }],
  }).sort({ name: 1 });

  const today = istDate();
  const visits = await Promise.all(
    families.map(async (parent) => {
      const [medicines, logged, checkIns] = await Promise.all([
        Medicine.find({ parentId: parent.id }),
        getLoggedDoses(parent.id, today),
        CheckIn.countDocuments({ parentId: parent.id, date: today }),
      ]);
      const doses = medicines
        .filter((medicine) => medicine.isActiveOn(today))
        .flatMap(({ id, name, dose, times }) =>
          times.map((time) => ({
            medicineId: id,
            name,
            dose,
            time,
            status: logged.get(`${id}:${time}`) ?? null,
          })),
        )
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        id: parent.id,
        name: parent.name,
        age: parent.age ?? null,
        address: parent.address ?? '',
        location: fromPoint(parent.location),
        role: parent.primaryCaregiverId?.equals(req.user.id) ? 'primary' : 'backup',
        checkedInToday: checkIns > 0,
        doses,
      };
    }),
  );

  res.json({ date: today, visits });
}

export async function getCheckInPhoto(req, res) {
  const checkIn = await CheckIn.findById(req.params.id);
  if (!checkIn) throw new ApiError(404, 'We could not find that check-in');

  await findParentFor(req.user, checkIn.parentId);
  if (!checkIn.photo?.file) throw new ApiError(404, 'No photo');

  res.type(checkIn.photo.mime);
  res.set('Cache-Control', 'private, no-store');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  await sendFile(res, checkIn.photo.file);
}
