#!/usr/bin/env bash
# =============================================================
# CLI Proxy API — 纯净管理面板一键重建与部署脚本
#
# 定制能力矩阵：
#   1. 纯净去广告与多处视觉精炼：移除非必要商业推广与冗余项；
#   2. Cursor 深度增强：OAuth / 配额看板 / 上下文窗口与使用统计；
#   3. Cline 完整接入：
#      - 官方 Logo 原生注入（含暗黑主题适配）；
#      - OAuth 与 API Key 凭证优雅微光徽章（[OAuth] / [API Key]）与智能排版；
#      - Cline 凭证优先级展示与专属调度支持；
#      - 5h / 7d / 30d 动态多窗口用量看板。
#
# 默认模式：编译本地当前定制代码，不触碰 git，不自动拉官方最新。
#   ——保持本地定制稳定；只有显式传入 --upgrade 时才执行 git pull --rebase origin main。
#
# 参数：
#   （无）       默认：编译本地当前代码并部署到静态目录（不触碰 git）
#   --upgrade   拉官方最新并 rebase 本地定制（需人工确认 rebase 兼容性）
#
# 定制源码：私有仓 git@github.com:ShuaiHui/cli-proxy-panel.git
# =============================================================
set -euo pipefail

PANEL_DIR="/Users/shuaihui/Projects/Cli-Proxy-API-Management-Center"
TARGET_HTML="/Users/shuaihui/.cli-proxy-api/static/management.html"
PRIVATE_REPO="git@github.com:ShuaiHui/cli-proxy-panel.git"

UPGRADE=0
if [[ "${1:-}" == "--upgrade" ]]; then UPGRADE=1; fi

echo "==> CLIProxyAPI 纯净管理面板（含去广告 + Cursor / Cline 增强定制）重建脚本"
echo "    模式: $([[ "${UPGRADE}" == "1" ]] && echo "--upgrade 拉官方最新" || echo "默认保持本地定制版（不拉官方）")"

if [[ ! -d "${PANEL_DIR}" ]]; then
  echo "[-] 前端项目目录不存在: ${PANEL_DIR}"
  echo "    请克隆私有定制仓: git clone ${PRIVATE_REPO} ${PANEL_DIR}"
  exit 1
fi

cd "${PANEL_DIR}"

# 1. 检测本地是否有定制提交
# 禁止 git log | head | rg 管道写法：head 提前退出会让 git log 收到
# SIGPIPE(141)，pipefail 下管道判非零导致检测恒为"无"。
HAS_CUSTOM_COMMIT="no"
if [[ -n "$(git log --oneline -1 -- src/pages/UsageStatisticsPage.tsx src/pages/OAuthPage.tsx)" ]]; then
  HAS_CUSTOM_COMMIT="yes"
fi

missing_customizations() {
  echo "[-] 未检测到本地定制提交。"
  echo "    请从私有仓恢复:"
  echo "      git clone ${PRIVATE_REPO} ${PANEL_DIR}"
  echo "    或:"
  echo "      cd ${PANEL_DIR} && git fetch private main && git reset --hard private/main"
  exit 1
}

# 2. 对齐官方：仅 --upgrade 时执行 rebase；默认不触碰 git
if [[ "${UPGRADE}" == "1" ]]; then
  echo "==> --upgrade 模式：拉取官方最新并 rebase 本地定制..."
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[!] 检测到工作区有未提交改动，先自动 stash 后再对齐官方..."
    git stash push -u -m "rebuild-pure-panel auto-stash $(date +%Y%m%d_%H%M%S)"
    STASHED=1
  else
    STASHED=0
  fi

  GIT_PROXY_OPTS=()
  if nc -z -G 1 169.254.1.2 7212 2>/dev/null; then
    echo "==> 检测到 NAS 出海代理 (169.254.1.2:7212)，优先走 NAS 代理通道..."
    GIT_PROXY_OPTS=(-c "http.proxy=http://169.254.1.2:7212")
  elif nc -z -G 1 127.0.0.1 7890 2>/dev/null; then
    echo "==> 检测到本机代理 (127.0.0.1:7890)，通过本机代理通道..."
    GIT_PROXY_OPTS=(-c "http.proxy=http://127.0.0.1:7890")
  fi

  git "${GIT_PROXY_OPTS[@]}" fetch origin main
  if [[ "${HAS_CUSTOM_COMMIT}" == "yes" ]]; then
    echo "==> 检测到本地定制提交（rebase 优先）..."
    if git "${GIT_PROXY_OPTS[@]}" pull --rebase origin main; then
      echo "[+] rebase 成功，本地定制已重放到官方最新之上"
      if [[ "${STASHED}" == "1" ]]; then
        echo "==> 恢复 stash 中的未提交改动..."
        git stash pop || echo "[-] stash 恢复冲突，请人工处理: git stash list / git stash pop"
      fi
    else
      if [[ "${STASHED}" == "1" ]]; then
        git stash pop 2>/dev/null || true
      fi
      echo "[-] rebase 冲突！请人工处理："
      echo "    cd ${PANEL_DIR} && git status"
      echo "    解决后: git add <files> && git rebase --continue"
      echo "    或放弃: git rebase --abort"
      exit 1
    fi
  else
    missing_customizations
  fi
elif [[ "${HAS_CUSTOM_COMMIT}" == "no" ]]; then
  echo "==> 未检测到本地定制提交，但默认模式不触碰 git。"
  missing_customizations
else
  echo "==> 默认模式：使用本地当前代码（保持定制旧版），不拉官方更新。"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "  [i] 检测到工作区有未提交改动，将编译当前工作区状态（含未提交改动）。"
  fi
fi

# 3. 类型检查与 Vite 打包构建
echo "==> 编译纯净前端面板 (tsc & vite build)..."
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build

if [[ ! -f "dist/index.html" ]]; then
  echo "[-] 构建失败：未找到 dist/index.html"
  exit 1
fi

# 4. 部署到后端静态托管目录
echo "==> 部署构建产物到 ${TARGET_HTML}..."
mkdir -p "$(dirname "${TARGET_HTML}")"
cp dist/index.html "${TARGET_HTML}"

echo "[+] 纯净管理面板（含去广告 + Cursor / Cline 增强定制）重建部署完成！"
echo "    面板访问地址: http://127.0.0.1:8317/management.html"
echo "    （当前使用本地定制版，未拉官方最新；如需同步官方请加 --upgrade）"
