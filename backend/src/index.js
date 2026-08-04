require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(helmet());
// No cookies are used anymore — Firebase ID tokens travel as a Bearer
// header, so this doesn't need `credentials: true` or a cookie parser.
// (If you deploy frontend/backend as two Vercel projects using the
// frontend/vercel.json proxy, the browser only ever sees the frontend's
// own origin anyway, so CORS barely comes into play; this still covers
// direct-to-backend calls, e.g. from a mobile client or during local dev.)
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 })); // general API rate limit

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'laikipia-iqa-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);

// Centralized error handler — keeps controllers free of try/catch boilerplate
// duplication and ensures we never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// Only bind a port when run directly (local dev / a traditional Node host).
// On Vercel, api/index.js imports `app` and wraps it as a serverless
// function instead — calling app.listen() there would be a no-op at best
// and an error at worst, since Vercel manages the request lifecycle itself.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Laikipia IQA backend listening on :${PORT}`));
}

module.exports = app;
