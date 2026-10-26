# CLI Proxy API Management Center (Pure Edition)

A customized, single-file Web UI (React 19 + TypeScript + Vite 8) for operating and troubleshooting **CLI Proxy API** via its **Management API**. Deeply customized and enhanced based on upstream `router-for-me/Cli-Proxy-API-Management-Center`.

[中文文档](README_CN.md)

---

## 🌟 Key Custom Enhancements

- **🚫 Completely Ad-Free**: Stripped all third-party sponsor banners, referral promotions, and ad tracking endpoints (APIMart, ApiKeyFun, etc.) for a clean, distraction-free developer experience.
- **⚡ Full Cursor Ecosystem Integration**:
  - Native **Cursor OAuth login** support with the official brand vector icon restored.
  - **Multi-dimensional Quota Tracking**: Real-time tracking of Cursor usage, plan tiers, and billing window reset countdowns.
  - **Usage Statistics Dashboard**: Deep integration with `cursor-for-cpa` and usage statistics plugin for token and request observability.
- **🛡️ Armor-Grade Anti-White-Flash & Adaptive Themes**:
  - Replaced hardcoded `#ffffff` static background colors with theme semantic variables (`var(--bg-secondary)`).
  - Designed for network-latency environments (Docker containers, LAN, or NAS): injected initial loading opacity masking and smooth transition fade-in for `<iframe>` elements to eliminate native canvas white flash.
  - Fully adaptive across Dark (`#151412`), Light (`#faf9f5`), and Pure White modes.
- **🤖 Devin Official Native Integration**:
  - Built-in Devin OAuth login flow and session token management.
  - Quota card headers intelligently prioritize showing the credential's **real account email**, eliminating unreadable machine hashes.
- **🐾 Cline / Cline Pass Ecosystem & Quota Tracking**:
  - Full support for **Cline Pass** credential recognition and official brand icon (showing `cline-<email>` identity).
  - **Multi-window Quota Tracking**: Real-time parsing and visualization of Cline Pass plans (5h rolling, 7d weekly, and 30d monthly usage percentages with reset countdowns).
  - **Model Catalog & Disabling**: Built-in static catalog for Cursor and Cline models, fully unlocking custom OAuth model disabling and aliasing in Credential Management.
  - **Multi-protocol Ecosystem**: Deep synergy with `cline-for-cpa` and CLI Proxy backend for `cline-pass/*` subscription model routing.
- **🧹 Streamlined Providers & Navigation**:
  - Removed redundant third-party reseller channels and extraneous login methods to keep the workbench clean and focused.

---

## 🏗️ Dual-Node Architecture

The management center builds into a **single-file inlined HTML (`management.html`)**, deployed seamlessly across dual nodes:

| Node | Environment | Endpoint | Deployment Path | Daemon |
| :--- | :--- | :--- | :--- | :--- |
| **Mac Local Node** | macOS Apple Silicon (`darwin_arm64`) | `http://127.0.0.1:8317/management.html` | `~/.cli-proxy-api/static/management.html` | macOS LaunchAgent (`com.cli-proxy-api`) |
| **ASUSTOR NAS Node** | Linux x86_64 (`linux_amd64`) | `http://169.254.1.2:8317/management.html` | `/volume1/Docker/cliproxy/static/management.html` | Docker Container (`cliproxy`) |

---

## 🚀 Quick Start & Building

### 1. Local Development
```bash
bun install --frozen-lockfile
bun run dev
```
Open `http://localhost:5173` and connect with your Management Key.

### 2. One-Click Build & Deploy (Recommended)
This repository includes a dedicated build automation script `rebuild-pure-panel.sh`:
```bash
# Default mode: compile current custom code and deploy to Mac static directory
bash rebuild-pure-panel.sh

# Upgrade mode: fetch upstream main and rebase custom commits (requires compatibility review)
bash rebuild-pure-panel.sh --upgrade
```

### 3. Manual Single-File Build
```bash
bun run build
# Output is generated at dist/index.html with all assets inlined.
# Copy to the proxy static directory and rename to management.html for hot-reloading.
```

---

## 🔑 Connection & Security Notes

### 1. API Address
Accepts `localhost:8317`, `127.0.0.1:8317`, or LAN IP addresses like `http://169.254.1.2:8317`. The Web UI automatically normalizes the input.

### 2. Management Key
The management key authenticates `/v0/management/*` administrative calls (distinct from client proxy `api-keys`):
- Transmitted as: `Authorization: Bearer <MANAGEMENT_KEY>`

### 3. Anti-Overwrite Lock (Critical Setting)
In `config.yaml`, ensure the auto-update panel setting is disabled so the binary does not overwrite your custom panel with official upstream assets on startup:
```yaml
remote-management:
  allow-remote-management: true
  disable-auto-update-panel: true   # 👈 Lock to prevent auto-overwriting
```

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript 6.0
- **Build Tool**: Vite 8 (`vite-plugin-singlefile`) + SCSS
- **State Management**: Zustand
- **Routing**: React Router DOM v7 (HashRouter)
- **Networking**: Axios + Server-Sent Events (SSE)
- **Internationalization**: i18next (zh-CN, zh-TW, en, ru)

---

## 📜 License & Attribution

- Upstream Project: [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)
- Licensed under the MIT License.
