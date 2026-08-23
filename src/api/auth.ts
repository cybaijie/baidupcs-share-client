import axios from 'axios'

export interface LoginResult {
  token: string
}

function getClient(serverUrl: string) {
  const base = serverUrl.replace(/\/+$/, '')
  return axios.create({
    baseURL: `${base}/api/v1`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  })
}

function extractToken(data: any): string | null {
  if (!data) return null
  const candidates = [
    data.data?.token,
    data.data?.access_token,
    data.access_token,
    data.token,
  ]
  for (const t of candidates) {
    if (t) return t
  }
  return null
}

export async function verifyNoAuth(serverUrl: string): Promise<void> {
  const client = getClient(serverUrl)
  try {
    await client.get('/transfers', { timeout: 10000 })
  } catch (e: any) {
    const status = e.response?.status
    if (status === 401 || status === 403 || status === 419) {
      throw new Error('后端已启用认证，无法使用无认证模式，请选择正确的认证方式')
    }
    try {
      await client.get('/', { timeout: 10000 })
    } catch (e2: any) {
      const s2 = e2.response?.status
      if (s2 === 401 || s2 === 403 || s2 === 419) {
        throw new Error('后端已启用认证，无法使用无认证模式')
      }
    }
  }
}

export async function loginWithPassword(serverUrl: string, password: string): Promise<LoginResult> {
  const client = getClient(serverUrl)
  const endpoints = [
    { path: 'auth/login', payload: { password } },
    { path: 'web-auth/login', payload: { password } },
    { path: 'auth/web-login', payload: { password } },
    { path: 'login', payload: { password } },
    { path: 'auth', payload: { password } },
  ]

  for (const ep of endpoints) {
    try {
      const res = await client.post(ep.path, ep.payload)
      const data = res.data
      if (data.code === 0 || data.status === 'success' || data.status === 'ok') {
        const token = extractToken(data)
        if (token) return { token }
      }
    } catch (e: any) {
      const status = e.response?.status
      if (status === 401 || status === 403 || status === 419) continue
    }
  }
  throw new Error('密码认证失败，请检查密码或后端地址')
}

export async function loginWith2FA(serverUrl: string, password: string, code: string): Promise<LoginResult> {
  const client = getClient(serverUrl)
  const endpoints = [
    { path: 'auth/login', payload: { password, totp_code: code } },
    { path: 'auth/login', payload: { password, code } },
    { path: 'auth/login', payload: { password, otp: code } },
    { path: 'auth/login', payload: { password, two_factor_code: code } },
    { path: 'web-auth/login', payload: { password, totp_code: code } },
    { path: 'auth/2fa', payload: { password, totp_code: code } },
    { path: 'auth/2fa', payload: { password, code } },
    { path: 'auth/2fa', payload: { password, otp: code } },
  ]

  for (const ep of endpoints) {
    try {
      const res = await client.post(ep.path, ep.payload)
      const data = res.data
      if (data.code === 0 || data.status === 'success' || data.status === 'ok') {
        const token = extractToken(data)
        if (token) return { token }
      }
    } catch (e: any) {
      const status = e.response?.status
      if (status === 401 || status === 403 || status === 419) continue
    }
  }
  return loginWithPassword(serverUrl, password)
}

export async function loginWith2FAOnly(serverUrl: string, code: string): Promise<LoginResult> {
  const client = getClient(serverUrl)
  const endpoints = [
    { path: 'auth/2fa', payload: { code, otp: code } },
    { path: 'auth/verify-2fa', payload: { code } },
    { path: '2fa/verify', payload: { code } },
    { path: 'auth/login', payload: { totp_code: code } },
    { path: 'auth/login', payload: { code } },
    { path: 'auth/login', payload: { otp: code } },
  ]

  for (const ep of endpoints) {
    try {
      const res = await client.post(ep.path, ep.payload)
      const data = res.data
      if (data.code === 0 || data.status === 'success' || data.status === 'ok') {
        const token = extractToken(data)
        if (token) return { token }
      }
    } catch (e: any) {
      const status = e.response?.status
      if (status === 401 || status === 403 || status === 419) continue
    }
  }
  throw new Error('2FA认证失败，请检查验证码')
}
