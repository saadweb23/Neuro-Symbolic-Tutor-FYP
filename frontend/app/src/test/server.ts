import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Default: nobody is signed in. Tests call signInAs() (test/utils) to become a student.
export const server = setupServer(
  http.get('http://localhost:8000/auth/me', () => HttpResponse.json({ detail: 'Not signed in.' }, { status: 401 })),
)
