const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/db');

// Each stage gets its own vertical slot in the right-hand margin, stacked
// bottom-to-top in the order it happens — Trainer submission at the bottom,
// then HOD, IQA, DP going up — so none of the four stamps ever overlap even
// though they all end up on the same final page across separate events.
const STAGE_ORDER = { TRAINER: -1, HOD: 0, IQA: 1, DP: 2 };
const BOX_HEIGHT = 128;
const BOX_GAP = 14;
const BOX_WIDTH = 220;

// Per-role text/border color, as specified: blue for the trainer's own
// submission stamp, purple for HOD, red for IQA, yellow for DP Academics.
// The DP color is a slightly deepened yellow (rgb below) rather than a pure
// #FFFF00 — pure yellow is close to unreadable as text on a white page, so
// this keeps it recognizably "yellow" while still legible.
const STAGE_COLOR = {
  TRAINER: rgb(0.12, 0.32, 0.85), // blue
  HOD: rgb(0.52, 0.13, 0.68), // purple
  IQA: rgb(0.78, 0.12, 0.12), // red
  DP: rgb(0.72, 0.58, 0.04), // yellow
};

const STAGE_LABEL = {
  TRAINER: 'Submitted by',
  HOD: 'Head of Department — Approved',
  IQA: 'IQA Officer — Approved',
  DP: 'DP Academics — Approved',
};

async function getActiveAsset(userId, kind) {
  return prisma.signatureAsset.findFirst({
    where: { userId, kind, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

function boxPositionFor(stage, pageWidth) {
  const boxX = pageWidth - BOX_WIDTH - 30;
  const slot = STAGE_ORDER[stage] ?? 0;
  const boxY = 40 + (slot + 1) * (BOX_HEIGHT + BOX_GAP);
  return { boxX, boxY };
}

/**
 * Shared drawing routine for both the trainer's submission stamp and every
 * reviewer's approval stamp — same box/slot mechanism, different color and
 * label, and only reviewer stamps include a stamp-of-office image (a
 * trainer submitting their own work has a signature but no institutional
 * stamp).
 */
async function drawStampBox(pdfDoc, lastPage, { stage, person, includeOfficialStamp }) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const color = STAGE_COLOR[stage] || rgb(0.2, 0.2, 0.2);

  const { width } = lastPage.getSize();
  const { boxX, boxY } = boxPositionFor(stage, width);

  lastPage.drawRectangle({
    x: boxX, y: boxY, width: BOX_WIDTH, height: BOX_HEIGHT,
    borderColor: color, borderWidth: 1.25,
  });

  const textX = boxX + 10;
  let cursorY = boxY + BOX_HEIGHT - 16;

  lastPage.drawText(STAGE_LABEL[stage] || stage, { x: textX, y: cursorY, size: 9.5, font: fontBold, color });
  cursorY -= 15;
  lastPage.drawText(person.fullName, { x: textX, y: cursorY, size: 10, font, color });
  cursorY -= 13;
  if (person.designation) {
    lastPage.drawText(person.designation, { x: textX, y: cursorY, size: 8, font, color });
    cursorY -= 12;
  }
  lastPage.drawText(new Date().toLocaleString('en-KE'), { x: textX, y: cursorY, size: 8, font, color });

  // Enlarged signature/stamp images per this revision — big enough to read
  // clearly on a printed page, not just a token mark.
  try {
    const signatureAsset = await getActiveAsset(person.id, 'SIGNATURE');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (signatureAsset) {
      const sigPath = path.join(uploadDir, path.basename(signatureAsset.fileUrl));
      if (fs.existsSync(sigPath)) {
        const sigImage = await pdfDoc.embedPng(fs.readFileSync(sigPath));
        const sigDims = sigImage.scaleToFit(120, 46);
        lastPage.drawImage(sigImage, { x: textX, y: boxY + 8, width: sigDims.width, height: sigDims.height });
      }
    }
    if (includeOfficialStamp) {
      const stampAsset = await getActiveAsset(person.id, 'STAMP');
      if (stampAsset) {
        const stampPath = path.join(uploadDir, path.basename(stampAsset.fileUrl));
        if (fs.existsSync(stampPath)) {
          const stampImage = await pdfDoc.embedPng(fs.readFileSync(stampPath));
          const stampDims = stampImage.scaleToFit(64, 64);
          lastPage.drawImage(stampImage, {
            x: boxX + BOX_WIDTH - stampDims.width - 10, y: boxY + 8,
            width: stampDims.width, height: stampDims.height,
          });
        }
      }
    }
  } catch (assetErr) {
    // A malformed signature/stamp PNG should never block an upload or
    // approval from completing — log and continue with a text-only stamp.
    console.warn(`[pdfStamper] failed to embed signature/stamp for ${person.id}:`, assetErr.message);
  }
}

async function loadLatestPdf(document) {
  const latestVersion = (document.versions || [])[0];
  if (!latestVersion) return null;
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const inputPath = path.join(uploadDir, path.basename(latestVersion.fileUrl));
  if (!fs.existsSync(inputPath)) {
    // In this scaffold, storage may be a remote adapter (Supabase/Firebase)
    // rather than local disk — swap this read for storage.getBuffer(url).
    console.warn(`[pdfStamper] source file not found locally, skipping stamp: ${inputPath}`);
    return null;
  }
  return { inputPath, pdfDoc: await PDFDocument.load(fs.readFileSync(inputPath)) };
}

async function saveNewVersion(document, pdfDoc, { isFinal = false, verificationNumber = undefined } = {}) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const stampedBytes = await pdfDoc.save();
  const nextVersionNo = document.currentVersionNo + 1;
  const outFileName = `${document.id}-v${nextVersionNo}.pdf`;
  fs.writeFileSync(path.join(uploadDir, outFileName), stampedBytes);

  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNo: nextVersionNo,
      fileUrl: outFileName,
      fileHash: crypto.createHash('sha256').update(stampedBytes).digest('hex'),
      isFinal,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersionNo: nextVersionNo,
      ...(verificationNumber !== undefined ? { verificationNumber } : {}),
    },
  });

  return nextVersionNo;
}

/**
 * Stamps the trainer's own name/date/signature ("Submitted by") onto their
 * document immediately on upload — before any review has happened. Blue,
 * per the color scheme. Runs even if the trainer hasn't uploaded a
 * signature image yet (falls back to a text-only stamp).
 */
async function stampSubmission(documentId, trainerId) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
  });
  const trainer = await prisma.user.findUniqueOrThrow({ where: { id: trainerId } });

  const loaded = await loadLatestPdf(document);
  if (!loaded) return null;
  const { pdfDoc } = loaded;
  const lastPage = pdfDoc.getPages().at(-1);

  await drawStampBox(pdfDoc, lastPage, { stage: 'TRAINER', person: trainer, includeOfficialStamp: false });

  const versionNo = await saveNewVersion(document, pdfDoc);
  return { versionNo };
}

/**
 * Appends a reviewer's name/designation/date/signature/stamp block to the
 * document's current PDF version, without altering the original layout —
 * it draws into the page margin rather than over existing content. Called
 * once per successful (APPROVED) decision at every stage — HOD, IQA, and DP
 * — per the spec's "after every stage ... append name, date, and signature"
 * requirement. Each call creates a new DocumentVersion so the stamp trail
 * is itself versioned and auditable.
 *
 * A text verification number is still recorded on final (DP) approval for
 * record-keeping, but no QR code is drawn onto the page.
 */
async function stampApprovalPdf(documentId, { stage, reviewerId }) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
  });
  const reviewer = await prisma.user.findUniqueOrThrow({ where: { id: reviewerId } });

  const loaded = await loadLatestPdf(document);
  if (!loaded) return null;
  const { pdfDoc } = loaded;
  const lastPage = pdfDoc.getPages().at(-1);

  const isFinal = stage === 'DP';
  const verificationNumber = isFinal
    ? `LETVC-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`
    : undefined;

  await drawStampBox(pdfDoc, lastPage, { stage, person: reviewer, includeOfficialStamp: true });

  if (verificationNumber) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { width } = lastPage.getSize();
    const { boxX, boxY } = boxPositionFor(stage, width);
    lastPage.drawText(`Verification No: ${verificationNumber}`, {
      x: boxX, y: boxY - 12, size: 7, font, color: rgb(0.3, 0.3, 0.3),
    });
  }

  const versionNo = await saveNewVersion(document, pdfDoc, { isFinal, verificationNumber });
  return { verificationNumber, versionNo };
}

module.exports = { stampApprovalPdf, stampSubmission };
