const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// multer.memoryStorage() puts the uploaded file entirely in req.file.buffer
// instead of writing it to disk itself. This is deliberate: local disk on a
// serverless host (Vercel) is either read-only or ephemeral, so writing
// straight to disk here was the root cause of files "disappearing" between
// requests. Controllers now take req.file.buffer and hand it to
// services/storage.js, which persists it to Supabase Storage (or local
// disk, for simple local dev) — see that file for details.
const memoryStorage = multer.memoryStorage();

function generateFileKey(originalname) {
  return `${uuidv4()}${path.extname(originalname)}`;
}

function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are accepted'));
  }
  cb(null, true);
}

const upload = multer({ storage: memoryStorage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

// Separate uploader for images: profile photos, and the transparent PNG
// signature/stamp assets the spec calls for under "Signature & Stamp
// Management". Signatures/stamps are required to be PNG (so transparency
// is preserved when pdfStamper.js embeds them into an approved document);
// profile photos are more lenient since they're never embedded into a PDF.
function pngOnlyFilter(req, file, cb) {
  if (file.mimetype !== 'image/png') {
    return cb(new Error('Only transparent PNG files are accepted for signatures and stamps'));
  }
  cb(null, true);
}

function photoFilter(req, file, cb) {
  if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
    return cb(new Error('Only PNG or JPEG images are accepted'));
  }
  cb(null, true);
}

const uploadSignatureImage = multer({ storage: memoryStorage, fileFilter: pngOnlyFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadPhoto = multer({ storage: memoryStorage, fileFilter: photoFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// EXTENSION POINT: run scanFile() before the file is treated as persisted.
// Wire to ClamAV (e.g. clamscan npm package) at deployment time. Takes the
// in-memory buffer now rather than a file path, since nothing is written
// to disk before this runs.
async function scanFile(buffer) {
  return { clean: true }; // pass-through stub in dev
}

module.exports = { upload, uploadSignatureImage, uploadPhoto, generateFileKey, scanFile };
