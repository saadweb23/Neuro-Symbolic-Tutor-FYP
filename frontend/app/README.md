# NeuroTutor frontend

React 19 + TypeScript (strict) + Vite, Tailwind CSS (build-time, `@tailwindcss/vite`), React Router 7,
TanStack Query, Recharts, Motion, Radix UI (dialog / dropdown / tooltip / tabs), Lucide icons.
It talks to the FastAPI backend in `../../backend`; every number on screen comes from an API response.

```bash
npm install
npm run dev -- --port 5173 --host 0.0.0.0   # the backend must be running on port 8000
npm run typecheck && npm test && npm run build
npm run e2e                                  # Playwright, real backend (see below)
npm run types                                # regenerate src/api/types/generated.ts from openapi.json
```

The API base is `http://<page hostname>:8000` (works from a phone on the LAN); `VITE_API_BASE` overrides it.

## Structure (`src/`)
| Folder | What lives there |
|---|---|
| `app/` | providers (preferences, query client, student identity, `/meta`, toasts), `BootGate` (cold-start screen), router + guards |
| `layouts/` | `AppShell` (sidebar / tab bar), `FocusLayout` (placement, workspace), `PublicLayout` |
| `pages/` | one folder per route: landing, onboarding, placement, dashboard, learn, workspace, mastery, analytics, history, resources, settings, help |
| `features/` | domain logic and feature components: workspace state machine, concept graph layout, analytics shaping, history export, resource grouping |
| `components/` | `ui/` primitives, `brand/` (3D cube), `domain/` (tiles, block cards), `learning/` (question, feedback), `feedback/` (empty / error), `nav/` |
| `api/` | `client.ts` (fetch + normalised `ApiError`), `queries/` (TanStack hooks + key factory), `types/` (hand-written `/next` contract + generated types) |
| `styles/` | `index.css` (design tokens, light + dark), `cube.css` (CSS-3D cube, also linked from `index.html` for the instant splash) |

## Rules worth knowing
- **`GET /next` consumes a learning round.** Only the Learning Workspace calls it (a mutation, never cached, never auto-refetched). Dashboard, analytics and previews use read-only endpoints (`/recommendation`, `/summary`, ...).
- Thresholds (mastery target, session cap, tier cut-offs) come from `GET /meta`; do not hardcode them.
- Mastery tiers are always shown as icon + label, never colour alone.
- The cube only animates `transform` / `opacity`, and honours `prefers-reduced-motion` and the in-app override.
- Mock data exists only in tests (MSW); no UI renders fabricated data.

## End-to-end tests
`npm run e2e` starts the backend (`E2E_PYTHON`, default `python`; question-bank mode, throwaway SQLite file) and the dev server, then runs the specs in `e2e/` (student journey, read-only guarantee, axe accessibility in both themes, responsive layout, theme / reduced motion). Set `PW_CHROMIUM_PATH` to use an existing Chromium, `E2E_REUSE=1` to reuse servers that are already running.
