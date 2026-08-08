const admin = require('firebase-admin');

// Two ways to supply credentials, in priority order:
//   1. FIREBASE_SERVICE_ACCOUNT_JSON — the whole service account JSON as one
//      env var (handy for Vercel, where you can't easily ship a file).
//   2. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY —
//      the same three fields split out, for platforms that prefer that.
// Get these from Firebase Console -> Project Settings -> Service Accounts ->
// Generate new private key.
function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.credential.cert(parsed);
  }
  return admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Private keys in .env files need their literal \n restored to real newlines.
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  });
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: loadCredential() });
  } catch (err) {
    // Without this log, a bad FIREBASE_PRIVATE_KEY/PROJECT_ID/CLIENT_EMAIL
    // on Vercel just shows up as a bare "FUNCTION_INVOCATION_FAILED" with no
    // clue why — check this message in the deployment's function logs.
    console.error('[firebaseAdmin] Failed to initialize — check FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON) are set correctly:', err.message);
    throw err;
  }
}

module.exports = admin;
