// Where the API lives. Derived from whatever host the browser used to load the page (localhost,
// a LAN IP, ...) so it works on the dev machine AND on a phone without edits, and survives the
// dev machine's IP changing. VITE_API_BASE overrides it for real deployments.
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || `http://${window.location.hostname}:8000`
