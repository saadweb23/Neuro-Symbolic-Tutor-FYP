import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run the REAL backend (question-bank mode, real tracker + PPO) against a
 * throwaway SQLite file and the Vite dev server. Nothing is mocked.
 *
 *   E2E_PYTHON       python executable with the backend deps (default: python)
 *   PW_CHROMIUM_PATH use an existing Chromium instead of Playwright's own download
 */
const DB = process.env.E2E_DB ?? path.join(os.tmpdir(), 'neurotutor-e2e.db')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // one shared database
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    video: 'off',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${process.env.E2E_PYTHON ?? 'python'} -m uvicorn main:app --host 127.0.0.1 --port 8000`,
      cwd: '../../backend',
      url: 'http://127.0.0.1:8000/meta',
      timeout: 240_000,
      reuseExistingServer: !!process.env.E2E_REUSE,
      // E2E_DATABASE_URL runs the whole suite against PostgreSQL instead of the throwaway SQLite file
      env: { TUTOR_DB_PATH: DB, AUTH_ALLOW_SIGNUP: '1', AUTH_RATE_SCALE: '1000', USE_QUESTION_BANK: 'true', PYTHONWARNINGS: 'ignore', ...(process.env.E2E_DATABASE_URL ? { DATABASE_URL: process.env.E2E_DATABASE_URL } : {}) },
    },
    {
      command: 'npm run dev -- --port 5173 --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      timeout: 120_000,
      reuseExistingServer: !!process.env.E2E_REUSE,
    },
  ],
})
