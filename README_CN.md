# CLI Proxy API 纯净增强管理中心 (CLI Proxy Panel)

用于管理与运维 **CLI Proxy API** 的单文件定制版 Web UI（React 19 + TypeScript + Vite 8），基于官方 `router-for-me/Cli-Proxy-API-Management-Center` 深度定制增强。

[English Documentation](README.md)

---

## 🌟 核心定制亮点

- **🚫 彻底纯净无广告**：完全剔除官方内置的全部三方赞助商横幅、推广软文与广告接口（APIMart、ApiKeyFun 等），还原本质开发体验。
- **⚡ Cursor 全生态深度打通**：
  - 原生支持 **Cursor OAuth 登录** 并补全官方丢失的品牌专属矢量图标。
  - **多维度配额追踪**：精准呈现 Cursor 使用额度、计费周期重置时间与当前计划详情。
  - **用量统计可视化**：深度集成 `cursor-for-cpa` 与用量统计插件，图表直观展示 Token 与请求流水。
- **🛡️ 装甲级防闪白与深浅模式自适应**：
  - 剔除官方硬编码的 `#ffffff` 静态底色，全面采用主题语义变量 `var(--bg-secondary)`。
  - 针对 Docker 容器、局域网或 NAS 等网络延迟环境，为 `<iframe>` 注入初始加载透明遮罩与平滑淡入，彻底消灭切换插件页面时的白色画布瞬时曝光。
  - 全局自适应深色（`#151412`）、浅色（`#faf9f5`）与纯白模式。
- **🤖 Devin 官方原生接入**：
  - 完整支持 Devin 官方 OAuth 登录与会话授权。
  - 配额卡片标题智能优先展示凭据的**真实账户邮箱**，杜绝无意义的机器哈希序列号。
- **🐾 Cline / Cline Pass 全生态打通与额度监控**：
  - 原生支持 **Cline Pass** 凭证识别与品牌专属图标（`cline-<email>` 身份展示）。
  - **多窗口配额追踪**：实时解析并可视化呈现 Cline Pass 套餐（如 5h、7d 周度、30d 月度滚动窗口百分比与重置倒计时）。
  - **模型目录与禁用支持**：内置 Cursor 与 Cline 完整静态模型目录，完美支持认证管理中的 OAuth 模型禁用与别名自定义。
  - **多协议生态适配**：与 `cline-for-cpa` / CLI Proxy 后端深度协同，支持 `cline-pass/*` 订阅模型转发。
- **🧹 提供商与交互净化**：
  - 下线冗余杂乱的第三方转售渠道与多余登录入口，精简侧栏与路由。
  - 聚焦核心大模型代理与日常运维，界面更加紧凑专业。

---

## 🏗️ 双端拓扑架构

管理面板编译产物为**单文件全内联 HTML (`management.html`)**，无缝部署在双端节点协同值守：

| 节点 | 运行环境 | 访问端点 | 部署路径 | 守护方式 |
| :--- | :--- | :--- | :--- | :--- |
| **Mac 本地节点** | macOS Apple Silicon (`darwin_arm64`) | `http://127.0.0.1:8317/management.html` | `~/.cli-proxy-api/static/management.html` | macOS LaunchAgent (`com.cli-proxy-api`) |
| **华硕 NAS 节点** | Linux x86_64 (`linux_amd64`) | `http://169.254.1.2:8317/management.html` | `/volume1/Docker/cliproxy/static/management.html` | Docker 容器 (`cliproxy`) |

---

## 🚀 快速开始与构建

### 1. 本地开发与调试
```bash
bun install --frozen-lockfile
bun run dev
```
启动后打开 `http://localhost:5173`，输入后端的管理密钥（Management Key）即可直连测试。

### 2. 一键编译与本地部署 (推荐)
本项目内置专用自动化脚本 `rebuild-pure-panel.sh`：
```bash
# 默认模式：编译本地当前定制源码，打包并部署到 Mac 本机 static 目录
bash rebuild-pure-panel.sh

# 升级模式：拉取官方最新 main 分支并自动 rebase 本地定制提交（需验证兼容）
bash rebuild-pure-panel.sh --upgrade
```

### 3. 手动单文件构建
```bash
bun run build
# 产物输出在 dist/index.html，资源已全部内联（Singlefile Bundle）。
# 将其拷贝至宿主的 static 目录并重命名为 management.html 即可热生效。
```

---

## 🔑 连接与安全配置说明

### 1. 连接地址
支持输入 `localhost:8317`、`127.0.0.1:8317`、`http://169.254.1.2:8317` 等格式，Web UI 会自动归一化处理。

### 2. 管理密钥（Management Key）
管理密钥不同于客户端调用大模型接口的代理 `api-keys`，它用于管理接口 `/v0/management/*` 的鉴权保护：
- 请求头携带：`Authorization: Bearer <MANAGEMENT_KEY>`

### 3. 防官方覆盖锁定（永久必须保留）
在 `config.yaml` 中务必确保配置以下选项，防止官方二进制在启动时自动下载官方带广告的 HTML 覆写本地定制面板：
```yaml
remote-management:
  allow-remote-management: true
  disable-auto-update-panel: true   # 👈 锁定禁止自动拉取覆盖
```

---

## 🛠️ 技术栈

- **前端框架**：React 19 + TypeScript 6.0
- **构建工具**：Vite 8 (`vite-plugin-singlefile`) + SCSS
- **状态管理**：Zustand
- **路由导航**：React Router DOM v7 (HashRouter)
- **网络通信**：Axios + SSE 流式监听
- **国际化**：i18next (中 / 繁 / 英 / 俄 4 种语言)

---

## 📜 许可与来源

- 官方上游仓库：[router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)
- 本项目遵循 MIT 开源协议。
