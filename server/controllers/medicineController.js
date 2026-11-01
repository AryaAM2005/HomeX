import { CheckIn } from '../models/CheckIn.js';
import { Medicine } from '../models/Medicine.js';
import { ApiError } from '../utils/ApiError.js';
import { findParentFor } from '../utils/parentAccess.js';
import { istDate } from '../utils/time.js';

function toPublicMedicine(medicine, loggedDoses) {
  const today = istDate();
  const activeToday = medicine.isActiveOn(today);

  return {
    id: medicine.id,
    name: medicine.name,
    dose: medicine.dose,
    times: medicine.times,
    startDate: medicine.startDate,
    endDate: medicine.endDate ?? null,
    stopped: Boolean(medicine.stoppedAt),
    activeToday,
    todayDoses: activeToday
      ? medicine.times.map((time) => ({
          time,
          status: loggedDoses.get(`${medicine.id}:${time}`) ?? null,
        }))
      : [],
  };
}

export async function getLoggedDoses(parentId, date) {
  const checkIns = await CheckIn.find({ parentId, date }, 'medicinesGiven');
  const logged = new Map();

  for (const { medicinesGiven } of checkIns) {
    for (const { medicineId, time, status } of medicinesGiven) {
      logged.set(`${medicineId}:${time}`, status);
    }
  }
  return logged;
}

export async function listMedicines(req, res) {
  const parent = await findParentFor(req.user, req.params.id);
  const [medicines, logged] = await Promise.all([
    Medicine.find({ parentId: parent.id }).sort({ createdAt: 1 }),
    getLoggedDoses(parent.id, istDate()),
  ]);

  res.json({
    parent: { id: parent.id, name: parent.name },
    medicines: medicines.map((medicine) => toPublicMedicine(medicine, logged)),
  });
}

export async function addMedicine(req, res) {
  const parent = await findParentFor(req.user, req.params.id);
  const medicine = await Medicine.create({
    ...req.body,
    endDate: req.body.endDate ?? undefined,
    parentId: parent.id,
    addedBy: req.user.id,
  });

  res.status(201).json({ medicine: toPublicMedicine(medicine, new Map()) });
}

export async function updateMedicine(req, res) {
  const parent = await findParentFor(req.user, req.params.id);
  const medicine = await Medicine.findOne({ _id: req.params.medicineId, parentId: parent.id });
  if (!medicine) throw new ApiError(404, 'We could not find that medicine');

  medicine.set({ ...req.body, endDate: req.body.endDate ?? undefined });
  await medicine.save();

  res.json({ medicine: toPublicMedicine(medicine, await getLoggedDoses(parent.id, istDate())) });
}

export async function stopMedicine(req, res) {
  const parent = await findParentFor(req.user, req.params.id);
  const medicine = await Medicine.findOneAndUpdate(
    { _id: req.params.medicineId, parentId: parent.id },
    { stoppedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!medicine) throw new ApiError(404, 'We could not find that medicine');

  res.json({ medicine: toPublicMedicine(medicine, new Map()) });
}
