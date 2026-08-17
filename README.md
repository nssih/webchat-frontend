# WebChat 前端

基于 React + TypeScript + Vite 构建的隐私优先即时通讯 PWA。

> 完整项目介绍请看根目录 [README.md](../README.md)

---

## 核心设计原则

所有加解密操作在**浏览器本地**完成，私钥永不上传，服务器只收到密文。

### 加密流程（私聊）

```
登录后自动生成 ECDH P-256 密钥对
    私钥 → 存入 IndexedDB（永不离开设备）
    公钥 → 上传服务器（其他用户用来给你加密）

发送消息时：
    ECDH(我的私钥, 对方公钥) → HKDF-SHA-256 → AES-GCM 128位密钥
    加密明文 → 密文发给服务器转发

收到消息时：
    ECDH(我的私钥, 发送方公钥) → HKDF-SHA-256 → AES-GCM 128位密钥
    解密密文 → 明文显示
```

### 加密流程（群聊）

```
群主创建群时生成随机 AES-GCM 256位群密钥
对每个成员用 ECDH 包装后分别上传服务器
成员用自己私钥解包 → 得到群密钥 → 加解密群消息
成员退出 → 自动触发密钥轮换（keyVersion+1），新密钥重新分发

群消息离线暂存：
  在线成员实时收到；离线成员同时存一份（带 keyVersion），上线后自动投递
  离线消息携带 keyVersion，上线后按版本取历史密钥解密（TTL 96h）
```

### 文件传输流程

```
发送方：文件切片(128KB) → 每片 AES-GCM 加密 → WebSocket 发送
              ↑ 等待 ACK
接收方：收到密文片 → 解密 → 写入本地磁盘 → 回 ACK
服务器：纯转发，不缓存任何字节
```

### 消息状态机

```
发送时：sending(○)
          ↓ 服务器 CHAT_DELIVERY
      sent(✓)         对方离线 → offline(⏱) 暂存服务器，上线后自动送达
          ↓ 对方 WS 收到消息回 MESSAGE_RECEIVED       ↓ 3天未上线
    received(✓✓灰)                             failed(✗) 已过期
          ↓ 对方打开聊天页发 MESSAGE_READ
       read(✓✓蓝)
```

### Token 无感恢复

```
Token 即将过期 / WS 连接前
    1. 用 Refresh Token 换新 Access Token
       ↓ 失败（Token 被吊销或过期）
    2. 跳转登录页，提示用户手动登录
```

### 服务器冷启动处理

部署在 Render / Railway 等平台时，服务器空闲后会休眠，首次请求需要等待唤醒：

- HTTP 请求超时设为 60 秒（覆盖冷启动时间）
- 网络错误自动重试一次（`_wakeRetry` 标记防无限循环）
- 请求超过 3 秒未响应，`useWakeHint` 自动显示"服务器正在唤醒，请稍候 (Xs)..."倒计时
- 60 秒后显示超时提示，引导用户检查网络

---

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`，后端需同时运行在 `http://localhost:8080`。

## 构建生产包

```bash
npm run build
# 产物在 dist/ 目录
```

## 环境变量

在 `frontend/` 目录创建 `.env.local`：

```env
VITE_API_URL=https://your-backend.com
VITE_WS_URL=wss://your-backend.com
```

不配置则默认使用 `http://localhost:8080` 和 `ws://localhost:8080`。

## 生产部署（当前）

| 组件 | 平台 | 说明 |
|---|---|---|
| 前端 | **Cloudflare Pages** | 静态托管，全球 CDN，自动构建 |
| 后端 API | Render（见后端 README） | `VITE_API_URL` 指向后端地址 |
| WebSocket | Render（见后端 README） | `VITE_WS_URL` 指向后端地址 |

---

## 目录结构

```
src/
├── api/          # HTTP 接口封装（axios，60s 超时覆盖冷启动，网络错误自动重试一次）
├── crypto/       # 加解密核心
│   ├── e2e.ts          # ECDH/HKDF/AES-GCM 实现
│   ├── keyStore.ts     # 密钥对生成与 IndexedDB 存取
│   ├── publicKeyCache.ts  # 对方公钥内存缓存
│   └── groupKeyCache.ts   # 群密钥内存缓存
├── db/           # IndexedDB 封装（消息/会话本地持久化）
├── hooks/
│   ├── useWebSocket.ts  # WebSocket 连接管理、消息处理、文件传输、心跳
│   └── useWakeHint.ts   # 服务器冷启动等待提示（3s后显示倒计时，60s超时提示）
├── pages/
│   ├── auth/     # 登录、注册（含无感恢复和冷启动提示）
│   ├── chat/     # 聊天页（消息收发、文件传输 UI、已读回执上报）
│   ├── friend/   # 在线用户列表
│   ├── group/    # 群组管理
│   ├── profile/  # 个人信息
│   └── about/    # 关于页面
├── store/
│   ├── authStore.ts  # 登录态（Zustand + sessionStorage 持久化，多标签页 BroadcastChannel 同步）
│   └── chatStore.ts  # 消息/会话状态（Zustand + IndexedDB 持久化）
├── components/   # 公共组件（消息气泡、布局等）
├── types/        # TypeScript 类型定义
└── utils/        # 工具函数（ID生成、会话ID、时间格式化等）
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| React | 19 | UI 框架 |
| TypeScript | 6 | 类型安全 |
| Vite | 6 | 构建工具 |
| Zustand | 5 | 全局状态管理 |
| React Router | 7 | 路由 |
| Axios | 1 | HTTP 请求 |
| idb | 8 | IndexedDB 封装 |
| Web Crypto API | 浏览器内置 | ECDH/HKDF/AES-GCM 加密 |
| File System Access API | 浏览器内置 | 大文件流式写盘 |
| vite-plugin-pwa | — | PWA / Service Worker |
