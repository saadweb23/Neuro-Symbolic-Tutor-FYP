import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { ApiError, get, post } from './client'

const BASE = 'http://localhost:8000'

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    return e as ApiError
  }
  throw new Error('expected the request to fail')
}

describe('api client', () => {
  it('returns parsed JSON on success', async () => {
    server.use(http.get(`${BASE}/ping`, () => HttpResponse.json({ ok: true })))
    expect(await get<{ ok: boolean }>('/ping')).toEqual({ ok: true })
  })

  it('normalises string `detail` errors', async () => {
    server.use(http.post(`${BASE}/x`, () => HttpResponse.json({ detail: 'Placement already completed' }, { status: 409 })))
    const err = await failure(post('/x', {}))
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.message).toBe('Placement already completed')
    expect(err.kind).toBe('http')
  })

  it('normalises FastAPI 422 array `detail` into a readable message', async () => {
    server.use(
      http.post(`${BASE}/v`, () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'block_index'], msg: 'Input should be less than or equal to 4', type: 'x' }] },
          { status: 422 },
        ),
      ),
    )
    const err = await failure(post('/v', {}))
    expect(err.kind).toBe('validation')
    expect(err.message).toBe('block_index: Input should be less than or equal to 4')
  })

  it('maps a network failure to a friendly error', async () => {
    server.use(http.get(`${BASE}/down`, () => HttpResponse.error()))
    const err = await failure(get('/down'))
    expect(err).toBeInstanceOf(ApiError)
    expect(err.kind).toBe('network')
    expect(err.message).toMatch(/Cannot reach the NeuroTutor server/)
  })
})
