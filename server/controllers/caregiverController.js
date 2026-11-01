import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { fromPoint, toPoint } from '../models/point.js';
import { User } from '../models/User.js';
import { detectFileType } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { blurCoordinate } from '../utils/geo.js';
import { deleteFile, filePath, saveFile } from '../utils/storage.js';
import { canSeeCaregiverPhone } from './assignmentController.js';
import { listCaregiverReviews } from './reviewController.js';

const MAX_DOCUMENTS = 10;
const MAX_RESULTS = 50;

function missingForReview(profile) {
  const hasDocument = (type) => profile.documents.some((document) => document.type === type);

  return [
    !profile.bio && 'A short bio',
    profile.services.length === 0 && 'At least one service',
    profile.languages.length === 0 && 'At least one language',
    !profile.location && 'Your area on the map',
    profile.availability.length === 0 && 'Your weekly availability',
    !hasDocument('id') && 'An ID document',
    !hasDocument('police') && 'Your police verification',
    !hasDocument('certificate') && 'A training certificate',
  ].filter(Boolean);
}

function toOwnerView(profile) {
  return {
    id: profile.userId,
    bio: profile.bio ?? '',
    services: profile.services,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    certificates: profile.certificates,
    area: profile.area ?? '',
    location: fromPoint(profile.location),
    serviceRadiusKm: profile.serviceRadiusKm,
    availability: profile.availability,
    hasPhoto: Boolean(profile.photo?.file),
    documents: profile.documents.map(({ id, type, name, createdAt }) => ({ id, type, name, createdAt })),
    policeVerified: profile.policeVerified,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason ?? null,
    submittedAt: profile.submittedAt ?? null,
    ratingAvg: profile.ratingAvg,
    ratingCount: profile.ratingCount,
    missing: missingForReview(profile),
  };
}

const getOwnProfile = (userId) =>
  CaregiverProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, returnDocument: 'after' },
  );

// New documents have not been checked yet, so an approved caregiver goes back for review.
async function requireReviewAgain(profile) {
  if (profile.verificationStatus !== 'approved') return;

  profile.verificationStatus = 'pending';
  profile.policeVerified = false;
  profile.submittedAt = new Date();
  await User.updateOne({ _id: profile.userId }, { isVerified: false });
}

export async function getMyProfile(req, res) {
  res.json({ profile: toOwnerView(await getOwnProfile(req.user.id)) });
}

export async function updateMyProfile(req, res) {
  const { location, ...details } = req.body;
  const profile = await getOwnProfile(req.user.id);

  profile.set(details);
  if (location) profile.location = toPoint(location);
  await profile.save();

  res.json({ profile: toOwnerView(profile) });
}

export async function uploadMyPhoto(req, res) {
  const fileType = req.file && detectFileType(req.file.buffer);
  if (!fileType || fileType.mime === 'application/pdf') {
    throw new ApiError(400, 'Upload a JPG or PNG photo');
  }

  const profile = await getOwnProfile(req.user.id);
  const previous = profile.photo?.file;

  profile.photo = { file: await saveFile(req.file.buffer, fileType.extension), mime: fileType.mime };
  await profile.save();
  if (previous) await deleteFile(previous);

  res.json({ profile: toOwnerView(profile) });
}

export async function addMyDocument(req, res) {
  const fileType = req.file && detectFileType(req.file.buffer);
  if (!fileType) throw new ApiError(400, 'Upload a PDF, JPG or PNG file');

  const profile = await getOwnProfile(req.user.id);
  if (profile.documents.length >= MAX_DOCUMENTS) {
    throw new ApiError(400, `You can upload up to ${MAX_DOCUMENTS} documents`);
  }

  profile.documents.push({
    type: req.body.type,
    name: req.file.originalname.slice(0, 120),
    file: await saveFile(req.file.buffer, fileType.extension),
    mime: fileType.mime,
  });
  await requireReviewAgain(profile);
  await profile.save();

  res.status(201).json({ profile: toOwnerView(profile) });
}

export async function deleteMyDocument(req, res) {
  const profile = await getOwnProfile(req.user.id);
  const document = profile.documents.id(req.params.documentId);
  if (!document) throw new ApiError(404, 'We could not find that document');

  const { file } = document;
  document.deleteOne();
  await requireReviewAgain(profile);
  await profile.save();
  await deleteFile(file);

  res.json({ profile: toOwnerView(profile) });
}

export async function submitForReview(req, res) {
  const profile = await getOwnProfile(req.user.id);

  if (profile.verificationStatus === 'approved' || profile.verificationStatus === 'pending') {
    throw new ApiError(409, 'Your profile has already been submitted');
  }

  const missing = missingForReview(profile);
  if (missing.length > 0) {
    throw new ApiError(400, `Still needed: ${missing.join(', ').toLowerCase()}`);
  }

  profile.verificationStatus = 'pending';
  profile.rejectionReason = undefined;
  profile.submittedAt = new Date();
  await profile.save();

  res.json({ profile: toOwnerView(profile) });
}

function toCard(profile, name) {
  const location = fromPoint(profile.location);

  return {
    id: String(profile.userId),
    name,
    bio: profile.bio ?? '',
    services: profile.services,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    area: profile.area ?? '',
    location: location && { lat: blurCoordinate(location.lat), lng: blurCoordinate(location.lng) },
    hasPhoto: Boolean(profile.photo?.file),
    policeVerified: profile.policeVerified,
    ratingAvg: profile.ratingAvg,
    ratingCount: profile.ratingCount,
    availabilityDays: profile.availability.map(({ day }) => day),
  };
}

export async function findNearby(req, res) {
  const { lat, lng, radius, service, minRating, day, language } = req.validQuery;

  const query = {
    verificationStatus: 'approved',
    ...(service && { services: service }),
    ...(minRating && { ratingAvg: { $gte: minRating } }),
    ...(day && { 'availability.day': day }),
    ...(language && { languages: language }),
  };

  const results = await CaregiverProfile.aggregate([
    {
      $geoNear: {
        near: toPoint({ lat, lng }),
        distanceField: 'distanceM',
        maxDistance: radius * 1000,
        spherical: true,
        query,
      },
    },
    { $match: { $expr: { $lte: ['$distanceM', { $multiply: ['$serviceRadiusKm', 1000] }] } } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
    { $limit: MAX_RESULTS },
  ]);

  res.json({
    caregivers: results.map((result) => ({
      ...toCard(result, result.user.name),
      distanceKm: Math.round(result.distanceM / 100) / 10,
    })),
  });
}

export async function getCaregiver(req, res) {
  const profile = await CaregiverProfile.findOne({ userId: req.params.id }).populate(
    'userId',
    'name phone isActive',
  );
  const isVisible =
    profile?.userId?.isActive &&
    (req.user.role !== 'customer' || profile.verificationStatus === 'approved');
  if (!isVisible) throw new ApiError(404, 'We could not find that caregiver');

  const { userId: user } = profile;
  const showPhone = await canSeeCaregiverPhone(req.user, user.id);

  res.json({
    caregiver: {
      ...toCard(profile.toObject({ virtuals: false, depopulate: true }), user.name),
      id: user.id,
      availability: profile.availability,
      certificates: profile.certificates,
      serviceRadiusKm: profile.serviceRadiusKm,
      phone: showPhone ? user.phone : null,
      reviews: await listCaregiverReviews(user.id),
    },
  });
}

export async function getCaregiverPhoto(req, res) {
  const profile = await CaregiverProfile.findOne({ userId: req.params.id });
  if (!profile?.photo?.file) throw new ApiError(404, 'No photo');

  res.type(profile.photo.mime);
  // Allows the deployed frontend, on a different domain, to show the image.
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(filePath(profile.photo.file));
}

export async function getCaregiverDocument(req, res) {
  const isOwner = req.user.id === req.params.id;
  if (!isOwner && req.user.role !== 'admin') throw new ApiError(403, 'You do not have access to this');

  const profile = await CaregiverProfile.findOne({ userId: req.params.id });
  const document = profile?.documents.id(req.params.documentId);
  if (!document) throw new ApiError(404, 'We could not find that document');

  res.type(document.mime);
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(filePath(document.file));
}
