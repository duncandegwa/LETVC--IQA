const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Vercel's deployment bundle (/var/task) is READ-ONLY. The only writable
// path in a Vercel serverless function is /tmp — and even that is
// EPHEMERAL: it can be wiped between invocations and is never shared across
// function instances. That makes this fine for getting the app running
// without crashing, but NOT a real fix for persistent file storage — see
// README "Before you deploy anywhere" for the Supabase Storage swap this
// still needs before uploads can be relied on in production.
//
// process.env.VERCEL is set to '1' automatically by the platform, so we
// don't need a manual flag to detect this.
const defaultUploadDir = process.env.VERCEL ? '/tmp/uploads' : './uploads';
const uploadDir = process.env.UPLOAD_DIR || defaultUploadDir;

try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  // Never let a storage-directory problem crash the entire function on
  // every single request (including ones that don't even touch uploads) —
  // log it and let individual upload attempts fail with a clear error
  // instead of taking down /api/auth/me, /, and everything else with it.
  console.error(`[upload] could not create upload directory "${uploadDir}":`, err.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are accepted'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

// Separate uploader for images: profile photos, and the transparent PNG
// signature/stamp assets the spec calls for under "Signature & Stamp
// Management". Signatures/stamps are required to be PNG (so transparency
// is preserved when pdfStamper.js embeds them into an approved document);
// profile photos are more lenient since they're never embedded into a PDF.
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

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

const uploadSignatureImage = multer({ storage: imageStorage, fileFilter: pngOnlyFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadPhoto = multer({ storage: imageStorage, fileFilter: photoFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// EXTENSION POINT: run scanFile() before the file is treated as persisted.
// Wire to ClamAV (e.g. clamscan npm package) at deployment time.
async function scanFile(filePath) {
  return { clean: true }; // pass-through stub in dev
}

module.exports = { upload, uploadSignatureImage, uploadPhoto, uploadDir, scanFile };
