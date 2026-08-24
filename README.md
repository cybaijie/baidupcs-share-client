# BaiduPCS-ShareDirect 客户端

基于 Tauri + Vue 3 + Element Plus 的百度网盘分享直下载客户端。

## 功能特性

- 分享链接直下（支持提取码自动识别）
- 下载管理（暂停/继续/删除/批量操作）
- 文件夹详情查看
- WebSocket 实时状态推送
- 自动清理网盘临时文件
- 多认证模式支持（无认证/密码/2FA）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri:dev

# 构建 Windows EXE
npm run tauri:build
```

## GitHub Actions 自动构建

推送代码到 `main` 分支后，GitHub Actions 会自动构建 Windows EXE 和 MSI 安装包。

## 技术栈

- Tauri v2
- Vue 3 + Composition API
- Element Plus
- Pinia
- Axios
