import axios from 'axios'
import { useSettingsStore } from '../stores/settings'

export interface LoginResult {
  token: string
}

export async function loginWithPassword(password: string): Promise<LoginResult> {
  const store = useSettingsStore()
  const res = await axios.post(`${store.baseURL}/api/v1/auth/login`, { password })
  return res.data.data
}

export async function loginWith2FA(password: string, code: string): Promise<LoginResult> {
  const store = useSettingsStore()
  const res = await axios.post(`${store.baseURL}/api/v1/auth/login`, { password, totp_code: code })
  return res.data.data
}
