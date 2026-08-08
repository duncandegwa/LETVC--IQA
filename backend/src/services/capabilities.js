const prisma = require('../config/db');

/**
 * Every authenticated STAFF user is implicitly a Trainer (can upload/view/edit
 * their own documents). HOD / IQA Officer / DP Academics are *additional*
 * capabilities layered on via DepartmentAssignment rows. This is why a user
 * can be simultaneously "ICT Trainer" and "ICT HOD" without any special-casing
 * elsewhere in the app — the UI and API just ask "does this user have the
 * HOD capability for department X", not "what is this user's role".
 *
 * Returns:
 * {
 *   isAdmin: boolean,
 *   isTrainer: boolean,               // true for every non-admin STAFF user
 *   hod: string[],                    // department IDs where user is HOD
 *   hodActing: string[],              // department IDs where user is an acting/alternate HOD
 *   iqa: string[],                    // department IDs where user is IQA Officer
 *   iqaActing: string[],
 *   dp: string[],                     // department IDs where user is DP Academics
 *   dpActing: string[],
 * }
 */
async function getUserCapabilities(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (user.systemRole === 'ADMIN') {
    return {
      isAdmin: true,
      isTrainer: false,
      hod: [], hodActing: [], iqa: [], iqaActing: [], dp: [], dpActing: [],
    };
  }

  const assignments = await prisma.departmentAssignment.findMany({
    where: {
      userId,
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
  });

  const bucket = (role, acting) =>
    assignments
      .filter((a) => a.role === role && a.isActing === acting)
      .map((a) => a.departmentId);

  return {
    isAdmin: false,
    isTrainer: true, // universal for STAFF users, per spec
    hod: bucket('HOD', false),
    hodActing: bucket('HOD', true),
    iqa: bucket('IQA_OFFICER', false),
    iqaActing: bucket('IQA_OFFICER', true),
    dp: bucket('DP_ACADEMICS', false),
    dpActing: bucket('DP_ACADEMICS', true),
  };
}

/** Convenience: can this user act as HOD (natural or acting) for this department? */
function canActAsHod(caps, departmentId) {
  return caps.hod.includes(departmentId) || caps.hodActing.includes(departmentId);
}
function canActAsIqa(caps, departmentId) {
  return caps.iqa.includes(departmentId) || caps.iqaActing.includes(departmentId);
}
function canActAsDp(caps, departmentId) {
  return caps.dp.includes(departmentId) || caps.dpActing.includes(departmentId);
}

module.exports = { getUserCapabilities, canActAsHod, canActAsIqa, canActAsDp };
