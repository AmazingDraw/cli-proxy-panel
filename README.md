# CLI Proxy API 纯净增强管理面板 (CLI Proxy Panel)

专为 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 打造的单文件纯净增强版 Web 管理控制台（React 19 + TypeScript + Vite 8）。
去除了全部商业营销与第三方转售渠道，原生深度打通 Cursor、Cline 与 Devin 生态，具备装甲级防闪白与本地 SQLite 用量统计能力。

---

## 🌟 核心特性

- 🚫 **彻底纯净无广告**：彻底拔除全部赞助商横幅（APIMart、SponsorCard 等）与外部推广渠道，还原极简专注的开发控制台。
- ⚡ **Cursor 全生态深度打通**：
  - 原生支持 Cursor OAuth 登录流程与品牌专属矢量图标；
  - 实时追踪 Cursor 使用额度、套餐计划（Plan）与重置倒计时；
  - 内置 Cursor 静态模型字典，支持模型别名与禁用规则。
- 🐾 **Cline / Cline Pass 深度接入**：
  - 原生识别 Cline Pass 凭据，自动标注 `[OAuth]` 与 `[API Key]` 优雅微光胶囊；
  - 专属额度看板：实时解析 5h、7d 周度与 30d 月度滚动窗口百分比与重置倒计时；
  - 自动归入独立 Cline Tab，支持单凭证手动刷新。
- 🛡️ **装甲级防闪白与深浅模式自适应**：
  - 剔除硬编码静态底色，全面采用主题语义变量 `var(--bg-secondary)`；
  - 针对 Docker、局域网或远程延迟环境，为 `<iframe>` 注入透明遮罩与平滑淡入，彻底杜绝切换插件页面时的刺眼白屏。
- 📊 **SQLite 使用统计大盘**：
  - 侧栏直达「使用统计」看板，直连本地 `usage-statistics` 数据库；
  - 直观呈现 Token 消耗趋势、响应耗时分布、首字时间（TTFT）与历史调用明细。
- 🤖 **Devin 原生邮箱直显**：配额卡片优先展示凭据的真实账户邮箱，告别冷冰冰的散列 UID。

---

## 🚀 快速构建与部署

### 1. 编译单文件
面板编译产物为单个纯静态 HTML 文件（所有 JS、CSS、SVG 资源完全内联）：

```bash
bun install --frozen-lockfile
bun run build
# 产物输出于 dist/index.html（约 3.2MB）
```

### 2. 部署到服务
将产物复制到代理后端的静态托管目录并重命名为 `management.html`：

```bash
# Mac 本地部署示例
cp dist/index.html ~/.cli-proxy-api/static/management.html

# 华硕 NAS Docker 容器部署示例
cp dist/index.html /volume1/Docker/cliproxy/static/management.html
```

---

## 🔍 运维铁律

1. **优雅延时重启（强制 3 秒延时）**：
   无论前端或后端服务，重启必须附加 `sleep 3`，防止端口并发抖动：
   - Mac 端：`launchctl kickstart -k gui/$(id -u)/com.cli-proxy-api && sleep 3`
   - NAS 容器端：`docker restart cliproxy && sleep 3`
2. **Kimi 真实浏览器核验**：
   面板构建分发后，必须通过 `kimi-webbridge` 驱动真实浏览器实机审查 `/usage-statistics`、`/ai-providers` 与 `/quota`，确保 0 缺陷交付。
3. **防官方自动覆盖锁定**：
   在 `config.yaml` 中永久保持：
   ```yaml
   remote-management:
     disable-auto-update-panel: true   # 锁定禁止官方二进制自动拉取覆盖
   ```

---

## 📜 开源协议

本项目基于 MIT License 开源，衍生自 [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)。
