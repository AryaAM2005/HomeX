import { detectFileType } from '../middleware/upload.js';
import { Booking } from '../models/Booking.js';
import { CareReport } from '../models/CareReport.js';
import { Parent } from '../models/Parent.js';
import { User } from '../models/User.js';
import { WellnessReport } from '../models/WellnessReport.js';
import { emitToUsers } from '../sockets/index.js';
import { raiseAlert } from '../utils/alerts.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from '../utils/notifications.js';
import { findParentFor } from '../utils/parentAccess.js';
import { SERVICE_CATALOG } from '../utils/services.js';
import { filePath, saveFile } from '../utils/storage.js';
import { findAbnormalVitals } from '../utils/vitals.js';

function toPublicCareReport(report, caregiverName, serviceLabel, visitDate) {
  return {
    id: report.id,
    bookingId: String(report.bookingId),
    service: serviceLabel,
    visitDate,
    caregiverName,
    doctorName: report.doctorName,
    hospital: report.hospital ?? '',
    diagnosisSummary: report.diagnosisSummary,
    vitals: report.vitals ?? {},
    prescriptions: report.prescriptions ?? '',
    nextFollowUp: report.nextFollowUp ?? null,
    notes: report.notes ?? '',
    attachments: report.attachments.map(({ id, name, mime }) => ({ id, name, mime })),
    createdAt: report.createdAt,
  };
}

async function saveAttachments(files = []) {
  const types = files.map(({ buffer }) => detectFileType(buffer));
  if (types.some((type) => !type)) throw new ApiError(400, 'Upload PDF, JPG or PNG files only');

  return Promise.all(
    files.map(async ({ buffer, originalname }, index) => ({
      name: originalname.slice(0, 120),
      file: await saveFile(buffer, types[index].extension),
      mime: types[index].mime,
    })),
  );
}

export async function submitCareReport(req, res) {
  const booking = await Booking.findOne({ _id: req.params.id, caregiverId: req.user.id });
  if (!booking) throw new ApiError(404, 'We could not find that booking');

  if (!SERVICE_CATALOG[booking.serviceType].medical) {
    throw new ApiError(409, 'Care reports are for doctor and lab visits');
  }
  if (booking.status !== 'COMPLETED') {
    throw new ApiError(409, 'Finish the visit before submitting its report');
  }

  const report = await CareReport.create({
    ...req.body,
    bookingId: booking.id,
    parentId: booking.parentId,
    caregiverId: req.user.id,
    attachments: await saveAttachments(req.files),
  });

  booking.status = 'REPORT_SUBMITTED';
  booking.statusHistory.push({ status: 'REPORT_SUBMITTED', by: req.user.name, at: new Date() });
  await booking.save();

  const parent = await Parent.findById(booking.parentId);
  const label = SERVICE_CATALOG[booking.serviceType].label;

  if (parent) {
    const content = { title: 'New care report', body: `${label} report for ${parent.name}.` };
    await notify(booking.customerId, { ...content, link: `/parents/${parent.id}/reports` });
    await notify(parent.careManagerId, content);

    const abnormal = findAbnormalVitals(req.body.vitals);
    if (abnormal.length > 0) {
      await raiseAlert({
        parent,
        type: 'abnormal_vitals',
        message: abnormal.join(', '),
        raisedBy: req.user.id,
        raisedVia: 'caregiver',
        dedupeKey: `abnormal_vitals:report:${report.id}`,
      });
    }
  }
  emitToUsers([booking.customerId, booking.caregiverId], 'booking:updated', { id: booking.id });

  res.status(201).json({ report: { id: report.id }, abnormalVitals: findAbnormalVitals(req.body.vitals) });
}

function toPublicWellness(report) {
  return {
    id: report.id,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    summary: report.summary,
    vitalsTrend: report.vitalsTrend ?? {},
    adherencePct: report.adherencePct ?? null,
    checkinCount: report.checkinCount,
    expectedCheckins: report.expectedCheckins,
    alertCount: report.alertCount,
  };
}

export async function listParentReports(req, res) {
  const parent = await findParentFor(req.user, req.params.id);

  const [careReports, wellnessReports] = await Promise.all([
    CareReport.find({ parentId: parent.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('bookingId', 'serviceType scheduledAt'),
    WellnessReport.find({ parentId: parent.id }).sort({ weekStart: -1 }).limit(52),
  ]);

  const caregivers = await User.find(
    { _id: { $in: careReports.map(({ caregiverId }) => caregiverId) } },
    'name',
  );

  res.json({
    parent: { id: parent.id, name: parent.name },
    careReports: careReports.map((report) => {
      const booking = report.bookingId;
      const caregiver = caregivers.find(({ id }) => report.caregiverId.equals(id));

      return toPublicCareReport(
        report.depopulate('bookingId'),
        caregiver?.name ?? 'Caregiver',
        SERVICE_CATALOG[booking?.serviceType]?.label ?? 'Visit',
        booking?.scheduledAt ?? report.createdAt,
      );
    }),
    wellnessReports: wellnessReports.map(toPublicWellness),
  });
}

export async function getReportAttachment(req, res) {
  const report = await CareReport.findById(req.params.id);
  const attachment = report?.attachments.id(req.params.attachmentId);
  if (!attachment) throw new ApiError(404, 'We could not find that file');

  if (!report.caregiverId.equals(req.user.id)) await findParentFor(req.user, report.parentId);

  res.type(attachment.mime);
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(filePath(attachment.file));
}
