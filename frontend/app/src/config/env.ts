// Where the API lives.
//  * VITE_API_BASE (build time) wins when set, e.g. a separately hosted API.
//  * Production build: the same origin that served the page. The backend can serve the built site
//    itself (see backend/main.py), so one public URL (e.g. a tunnel) is enough and no CORS is needed.
//  * Development: http://<page hostname>:8000, so it also works on a phone on the LAN.
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/+$/, '')

export const API_BASE: string =
  configured || (import.meta.env.PROD ? window.location.origin : `http://${window.location.hostname}:8000`)
