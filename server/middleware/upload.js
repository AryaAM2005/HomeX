import multer from 'multer';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SIGNATURES = [
  { mime: 'application/pdf', extension: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', extension: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', extension: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

export const uploadOneFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
}).single('file');

export const uploadOptionalPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
}).single('photo');

export const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
}).array('attachments', 5);

// A form with a file sends text fields as strings, so structured data arrives as JSON text.
export function parseJsonField(field) {
  return (req, res, next) => {
    try {
      req.body = JSON.parse(req.body?.[field] ?? '{}');
    } catch {
      req.body = {};
    }
    next();
  };
}

// Checks the file's real contents, because a browser's stated type can be faked.
export function detectFileType(buffer) {
  return SIGNATURES.find(({ bytes }) => bytes.every((byte, index) => buffer[index] === byte));
}
