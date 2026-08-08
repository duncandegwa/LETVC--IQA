const fs = require('fs');
const path = require('path');

// Two backends:
//   'supabase' — real persistent storage. Used automatically whenever
//     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. This is REQUIRED
//     for correct behavior on Vercel (or any serverless host) — local disk
//     there is either read-only or ephemeral (/tmp), so a file saved during
//     one request can vanish before the next request asks for it.
//   'local' — plain disk, only for local development convenience when you
//     don't want to set up a Storage bucket yet. Do not rely on this in
//     production.
const driver = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'supabase' : 'local';
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

let supabase = null;
if (driver === 'supabase') {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Local-disk fallback dir resolution — same /tmp-on-Vercel logic as before,
// kept only so 'local' driver doesn't crash if someone runs without
// Supabase credentials configured on a serverless host (it still won't
// persist properly, but it won't crash either).
let localDir = process.env.UPLOAD_DIR || './uploads';
if (process.env.VERCEL && !localDir.startsWith('/tmp')) localDir = '/tmp/uploads';
if (driver === 'local') {
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
  } catch (err) {
    console.error(`[storage] could not create local upload directory "${localDir}":`, err.message);
  }
}

if (driver === 'local' && process.env.VERCEL) {
  console.warn('[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — falling back to ephemeral /tmp storage on Vercel. Uploaded files WILL be lost between requests. Set those two env vars to fix this properly.');
}

/** Saves a buffer under `key` (e.g. a generated filename) and returns that same key. */
async function save(key, buffer) {
  if (driver === 'supabase') {
    const { error } = await supabase.storage.from(bucket).upload(key, buffer, { upsert: true });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  } else {
    fs.writeFileSync(path.join(localDir, key), buffer);
  }
  return key;
}

/** Loads the buffer stored under `key`. Throws if it doesn't exist. */
async function load(key) {
  if (driver === 'supabase') {
    const { data, error } = await supabase.storage.from(bucket).download(key);
    if (error) throw new Error(`Supabase Storage download failed for "${key}": ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
  return fs.readFileSync(path.join(localDir, key));
}

/** True if the key exists in storage, without throwing. */
async function exists(key) {
  try {
    await load(key);
    return true;
  } catch {
    return false;
  }
}

module.exports = { save, load, exists, driver, bucket };
