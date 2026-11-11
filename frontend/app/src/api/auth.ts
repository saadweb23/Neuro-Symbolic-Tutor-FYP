import { useQuery } from '@tanstack/react-query'
import { ApiError, get, post } from './client'
import { keys } from './queries/keys'

export interface AuthUser {
  id: string
  email: string
  name: string
  student_id: string
  created_at: string
  last_login_at: string | null
}

/** The signed-in account, or null when there is no valid session (401 is the normal signed-out answer). */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await get<AuthUser>('/auth/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: fetchMe, staleTime: 60_000, retry: false })

export const login = (username: string, password: string, remember: boolean) =>
  post<AuthUser>('/auth/login', { username, password, remember })

export const logout = () => post<{ message: string }>('/auth/logout')
