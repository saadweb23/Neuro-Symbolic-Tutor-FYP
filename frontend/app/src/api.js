// Derived from whatever host the browser actually used to load this page
// (localhost, a LAN IP, whatever) -- so it's correct on a phone AND on the
// dev machine without editing anything, and survives the dev machine's IP
// changing (DHCP renewal, switching networks) with no restart needed.
// VITE_API_BASE remains available as an explicit override for setups where
// the backend isn't just "the same host, port 8000" (e.g. a real deployment).
const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`;

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      detail = errJson.detail || detail;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(`${method} ${path} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export const api = {
  startPlacement: (studentId) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/placement/start`),

  submitPlacement: (studentId, answers) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/placement/submit`, answers),

  getNext: (studentId) =>
    request("GET", `/students/${encodeURIComponent(studentId)}/next`),

  submitMcqAnswer: (studentId, contentId, selectedIndex, timeTaken) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/mcq-answer`, {
      content_id: contentId,
      selected_index: selectedIndex,
      time_taken: timeTaken,
    }),

  markContentViewed: (studentId, concept, contentId, timeTaken) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/content-viewed`, {
      concept,
      content_id: contentId,
      time_taken: timeTaken,
    }),

  getMastery: (studentId) =>
    request("GET", `/students/${encodeURIComponent(studentId)}/mastery`),

  getBlocks: (studentId) =>
    request("GET", `/students/${encodeURIComponent(studentId)}/blocks`),

  getSession: (studentId) =>
    request("GET", `/students/${encodeURIComponent(studentId)}/session`),

  startSession: (studentId, blockIndex) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/session/start`, {
      block_index: blockIndex,
    }),

  continueSession: (studentId) =>
    request("POST", `/students/${encodeURIComponent(studentId)}/session/continue`, {}),
};
