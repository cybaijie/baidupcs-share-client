import axios from 'axios'

export interface LoginResult {
  token: string
  refreshToken?: string
  viaFallback?: boolean
}

function getClient(serverUrl: string) {
  const base = serverUrl.replace(/\/+$/, '')
  return axios.create({
    baseURL: `${base}/api/v1`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  })
}

/**
 * 从登录/刷新响应中提取 access_token 与 refresh_token。
 * 后端 /web-auth/login 返回的是 { status, access_token, refresh_token, ... }（顶层）。
 */
function extractTokens(data: any): { token: string; refreshToken?: string } | null {
  if (!data) return null
  const top = typeof data === 'object' ? data : {}
  const inner = top.data && typeof top.data === 'object' ? top.data : {}
  const token = top.access_token || inner.access_token || top.token || inner.token
  if (!token) return null
  const refreshToken = top.refresh_token || inner.refresh_token
  return { token, refreshToken: refreshToken || undefined }
}

/**
 * 使用 refresh_token 刷新 access_token（后端 /web-auth/refresh）。
 * access_token 有效期仅 15 分钟，需用 refresh_token（7 天）续期，否则频繁 419。
 */
export async function refreshAccessToken(
  serverUrl: string,
  refreshToken: string
): Promise<{ token: string; refreshToken?: string } | null> {
  try {
    const base = serverUrl.replace(/\/+$/, '')
    const r = await axios.post(
      `${base}/api/v1/web-auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15000 }
    )
    const tokens = extractTokens(r.data)
    return tokens
  } catch {
    return null
  }
}

/**
 * 读取已保存的 refresh_token 续期 access_token，并写回设置。
 * 用于 419（认证已过期）时自动刷新后重试，避免频繁要求重新登录。
 */
export async function tryRefreshStoredToken(): Promise<boolean> {
  try {
    const { useSettingsStore } = await import('../stores/settings')
    const store = useSettingsStore()
    const rt = store.config.refreshToken
    if (!rt) return false
    const result = await refreshAccessToken(store.baseURL, rt)
    if (result) {
      store.config.token = result.token
      if (result.refreshToken) store.config.refreshToken = result.refreshToken
      store.save()
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * 判断 access_token(JWT) 是否已过期。非 JWT 视为已过期。
 */
function isJwtExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1]
    if (!payload) return true
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return json.exp ? json.exp * 1000 < Date.now() : true
  } catch {
    return true
  }
}

/**
 * 启动时确保已认证：
 * 1) 有 refresh_token → 优先续期；
 * 2) 无 refresh_token 但 token 已过期/缺失，且保存了密码（记住密码）→ 自动登录一次；
 * 3) token 仍有效 → 直接沿用，不重复登录。
 */
export async function ensureAuthenticated(): Promise<void> {
  try {
    const { useSettingsStore } = await import('../stores/settings')
    const store = useSettingsStore()
    const mode = store.config.authMode

    if (store.config.refreshToken && (await tryRefreshStoredToken())) return

    const token = store.config.token
    const password = store.config.password
    if ((mode === 'password' || mode === 'password_2fa') && password && (!token || isJwtExpired(token))) {
      const result = await loginWithPassword(store.baseURL, password)
      if (result && !result.viaFallback) {
        store.config.token = result.token
        if (result.refreshToken) store.config.refreshToken = result.refreshToken
        store.save()
      }
    }
  } catch {
    // ignore
  }
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
  // web-auth/login 是本后端 Web 访问密码认证的正式端点，返回 access_token + refresh_token
  const endpoints = [
    { path: 'web-auth/login', payload: { password } },
    { path: 'auth/web-login', payload: { password } },
    { path: 'auth/login', payload: { password } },
    { path: 'login', payload: { password } },
    { path: 'auth', payload: { password } },
  ]

  for (const ep of endpoints) {
    try {
      const res = await client.post(ep.path, ep.payload)
      const data = res.data
      if (data.code === 0 || data.status === 'success' || data.status === 'ok') {
        const tokens = extractTokens(data)
        if (tokens) return { token: tokens.token, refreshToken: tokens.refreshToken }
      }
    } catch (e: any) {
      // 与 Python 脚本一致：任何异常（405/404/网络错误等）都继续尝试下一个端点
      continue
    }
  }

  // Fallback：与 Python 脚本一致，未找到标准登录接口时，将密码本身作为 Token
  return { token: password, viaFallback: true }
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
        const tokens = extractTokens(data)
        if (tokens) return { token: tokens.token, refreshToken: tokens.refreshToken }
      }
    } catch (e: any) {
      continue
    }
  }

  // Fallback：与 Python 脚本一致，降级到仅密码模式
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
        const tokens = extractTokens(data)
        if (tokens) return { token: tokens.token, refreshToken: tokens.refreshToken }
      }
    } catch (e: any) {
      continue
    }
  }

  // Fallback：将 2FA 码本身作为 Token
  return { token: code, viaFallback: true }
}
