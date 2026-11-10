/** Student ids are case-sensitive, 1-64 characters, with no slashes or control characters.
 *  The backend enforces the same rule on every /students/{id} route. */
export const STUDENT_ID_MAX = 64

export type StudentIdCheck = { ok: true; id: string } | { ok: false; reason: string }

export function checkStudentId(raw: string): StudentIdCheck {
  const id = raw.trim()
  if (!id) return { ok: false, reason: 'Enter your name or student ID.' }
  if (id.length > STUDENT_ID_MAX) return { ok: false, reason: `Keep it to ${STUDENT_ID_MAX} characters or fewer.` }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f/\\]/.test(id)) return { ok: false, reason: 'Slashes and control characters are not allowed.' }
  return { ok: true, id }
}
