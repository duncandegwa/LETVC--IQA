// Seeds a scenario matching the spec's own example:
//   John = ICT Trainer + ICT HOD  -> his uploads must route to another HOD.
//   Mary = Trainer + IQA Officer  -> her uploads must route to another IQA Officer.
//
// Creates a real Firebase Auth account for each seeded user (so you can
// actually log in with them), plus the matching Postgres profile.
// Requires the same FIREBASE_* / FIREBASE_SERVICE_ACCOUNT_JSON env vars as
// the running backend — see backend/.env.example.
//
// Run: npm run seed
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const admin = require('../src/config/firebaseAdmin');

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Changeme@1'; // same default used for every admin-created account — see userController.js

/** Creates the Firebase Auth user if it doesn't already exist, returns the uid either way. */
async function ensureFirebaseUser(email, displayName) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
  const created = await admin.auth().createUser({ email, password: SEED_PASSWORD, displayName });
  return created.uid;
}

async function upsertUser({ email, fullName, staffNumber, designation, primaryDepartmentId, systemRole }) {
  const firebaseUid = await ensureFirebaseUser(email, fullName);
  return prisma.user.upsert({
    where: { email },
    update: { firebaseUid },
    create: {
      firebaseUid, fullName, staffNumber, email, designation, primaryDepartmentId,
      systemRole: systemRole || 'STAFF',
      mustChangePassword: false, // seeded accounts skip the forced first-login change
    },
  });
}

async function main() {
  const admin_ = await upsertUser({
    email: 'admin@laikipiaeasttvc.ac.ke', fullName: 'System Administrator',
    staffNumber: 'ADM-001', systemRole: 'ADMIN',
  });

  const ict = await prisma.department.upsert({
    where: { code: 'ICT' }, update: {},
    create: { name: 'Information Communication Technology', code: 'ICT' },
  });

  const john = await upsertUser({
    email: 'john@laikipiaeasttvc.ac.ke', fullName: 'John Mwangi', staffNumber: 'ICT-001',
    designation: 'ICT Trainer / HOD', primaryDepartmentId: ict.id,
  });
  const grace = await upsertUser({
    email: 'grace@laikipiaeasttvc.ac.ke', fullName: 'Grace Wanjiru', staffNumber: 'ICT-002',
    designation: 'Acting HOD (Business)',
  });
  const mary = await upsertUser({
    email: 'mary@laikipiaeasttvc.ac.ke', fullName: 'Mary Achieng', staffNumber: 'ICT-003',
    designation: 'Trainer / IQA Officer', primaryDepartmentId: ict.id,
  });
  const peter = await upsertUser({
    email: 'peter@laikipiaeasttvc.ac.ke', fullName: 'Peter Kamau', staffNumber: 'ICT-004',
    designation: 'IQA Officer',
  });
  const dp = await upsertUser({
    email: 'dp@laikipiaeasttvc.ac.ke', fullName: 'Dr. Susan Njeri', staffNumber: 'DP-001',
    designation: 'Deputy Principal Academics',
  });

  // John is the ONLY natural HOD for ICT -> Grace is registered as the acting/
  // alternate HOD, so when John uploads, the resolver falls back to Grace
  // instead of ever assigning John to himself.
  await prisma.departmentAssignment.createMany({
    data: [
      { userId: john.id, departmentId: ict.id, role: 'HOD', isActing: false },
      { userId: grace.id, departmentId: ict.id, role: 'HOD', isActing: true },
      { userId: mary.id, departmentId: ict.id, role: 'IQA_OFFICER', isActing: false },
      { userId: peter.id, departmentId: ict.id, role: 'IQA_OFFICER', isActing: false },
      { userId: dp.id, departmentId: ict.id, role: 'DP_ACADEMICS', isActing: false },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete.');
  console.log(`All seeded users share password: ${SEED_PASSWORD}`);
  console.log('Try: John uploads a Learning Plan -> HOD review should assign to Grace, never John.');
  console.log('Try: Mary uploads a Session Plan -> IQA review should assign to Peter, never Mary.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
