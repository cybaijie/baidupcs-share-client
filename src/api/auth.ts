import axios from 'axios'
import { useSettingsStore } from '../stores/settings'

export interface LoginResult {
  token: string
}

export async function loginWithPassword(password: string): Promise<LoginResult> {
  const store = useSettingsStore()
  const res = await axios.post(`${store.baseURL}/api/v1/auth/login`, { password })
  const data = res.data.data
  if (!data?.token) throw new Error('登录失败：未返回 Token')
  return data
}

export async function loginWith2FA(password: string, code: string): Promise<LoginResult> {
  const store = useSettingsStore()
  const res = await axios.post(`${store.baseURL}/api/v1/auth/login`, { password, totp_code: code })
  const data = res.data.data
  if (!data?.token) throw new Error('登录失败：未返回 Token')
  return data
}
