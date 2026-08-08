// Vercel serverless entrypoint. Vercel treats every file under /api as its
// own function; this one just re-exports the existing Express app so all
// routes defined in src/index.js are served through a single function
// (mapped via the rewrite in vercel.json) instead of one function per route.
module.exports = require('../src/index.js');
