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

// access_token 有效期仅 15 分钟，启动时确保已认证（refresh 续期或用保存的密码自动登录），
// 避免一打开就因旧 token 过期而频繁提示"认证已过期，请重新登录"。
ensureAuthenticated()

app.mount("#app")
