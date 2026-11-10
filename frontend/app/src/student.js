const CURRENT_KEY = "neurotutor_current_student";
const KNOWN_KEY = "neurotutor_known_students";

export function getCurrentStudent() {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentStudent(id) {
  localStorage.setItem(CURRENT_KEY, id);
}

export function clearCurrentStudent() {
  localStorage.removeItem(CURRENT_KEY);
}

function getKnownStudents() {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isKnownStudent(id) {
  return getKnownStudents().includes(id);
}

export function markStudentKnown(id) {
  const known = getKnownStudents();
  if (!known.includes(id)) {
    known.push(id);
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  }
}
