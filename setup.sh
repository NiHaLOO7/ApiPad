#!/usr/bin/env bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[apipad]${RESET} $1"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $1"; }
die()     { echo -e "${RED}✗${RESET}  $1"; exit 1; }

echo ""
echo -e "${BOLD}ApiPad — Dev Setup${RESET}"
echo "────────────────────────────────"

# ── 1. Homebrew (macOS) ───────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! command -v brew &>/dev/null; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  else
    success "Homebrew already installed"
  fi
fi

# ── 2. Node.js ────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Installing Node.js via Homebrew..."
  brew install node
else
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( NODE_VER < 18 )); then
    warn "Node.js $NODE_VER found — need 18+. Upgrading..."
    brew upgrade node 2>/dev/null || brew install node
  else
    success "Node.js $(node -v) already installed"
  fi
fi

# ── 3. Rust ───────────────────────────────────────────────────
if ! command -v rustc &>/dev/null; then
  info "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  source "$HOME/.cargo/env"
else
  success "Rust $(rustc --version) already installed"
fi

# Make sure cargo is on PATH
if ! command -v cargo &>/dev/null; then
  source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
fi

# ── 4. Linux system deps (WebKit, etc.) ───────────────────────
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  info "Installing Linux system dependencies..."
  sudo apt-get update -q
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev \
    pkg-config \
    build-essential \
    curl \
    wget \
    libgtk-3-dev
fi

# ── 5. npm dependencies ───────────────────────────────────────
info "Installing npm dependencies..."
npm install
success "npm dependencies installed"

# ── 6. Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}All set!${RESET} Run the app with:"
echo ""
echo "  npm run tauri dev"
echo ""
