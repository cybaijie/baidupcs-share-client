import { createApp } from "vue"
import { createPinia } from "pinia"
import ElementPlus from "element-plus"
import "element-plus/dist/index.css"
import * as ElementPlusIconsVue from "@element-plus/icons-vue"
import App from "./App.vue"
import { useSettingsStore } from "./stores/settings"
import { ensureAuthenticated } from "./api/auth"

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)
app.use(ElementPlus)

// 在组件挂载前同步加载已保存的设置（token / 服务器地址 / 认证模式）。
// 否则子组件（如 DownloadManager）的 onMounted 会先于 App 的 onMounted 执行，
// 导致首屏 API 请求使用默认服务器/空 token，误触发\"重新登录\"。
useSettingsStore(pinia).load()

// access_token 有效期仅 15 分钟，启动时先主动验证 token 有效性并续期/自动登录，
// 等认证就绪后再挂载，避免首屏请求用旧 token 而报"认证已过期，请重新登录"。
// 用 race 限制等待上限，后端无响应时也不至于卡住启动。
const AUTH_TIMEOUT = 8000
Promise.race([
  ensureAuthenticated(),
  new Promise((r) => setTimeout(r, AUTH_TIMEOUT)),
]).then(() => {
  app.mount("#app")
})
