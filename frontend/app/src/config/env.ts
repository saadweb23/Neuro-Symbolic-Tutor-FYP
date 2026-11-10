// Where the API lives. In production this MUST be set (VITE_API_BASE, in the Vercel project
// settings) to the public URL of the API. For local development it is derived from whatever host
// the browser used to load the page (localhost, a LAN IP, ...), so it also works on a phone and
// survives the dev machine's IP changing.
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/+$/, '')

export const API_BASE: string = configured || `http://${window.location.hostname}:8000`

if (import.meta.env.PROD && !configured) {
  console.error(
    'NeuroTutor: VITE_API_BASE was not set at build time, so API calls go to ' + API_BASE +
      '. Set VITE_API_BASE to the deployed API URL in the hosting settings and rebuild.',
  )
}
