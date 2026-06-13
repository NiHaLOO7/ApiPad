#!/bin/sh
set -e

REPO="NiHaLOO7/ApiPad"
VERSION="0.1.0"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unsupported" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo "arm64" ;;
    x86_64)        echo "x64" ;;
    *)             echo "unsupported" ;;
  esac
}

OS=$(detect_os)
ARCH=$(detect_arch)

if [ "$OS" = "unsupported" ] || [ "$ARCH" = "unsupported" ]; then
  echo "Unsupported platform. Download manually from:"
  echo "https://github.com/${REPO}/releases"
  exit 1
fi

echo "Detected: ${OS} / ${ARCH}"

if [ "$OS" = "macos" ]; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing via Homebrew..."
    brew tap NiHaLOO7/apipad
    brew install --cask apipad
  else
    if [ "$ARCH" = "arm64" ]; then
      FILE="ApiPad_${VERSION}_aarch64.dmg"
    else
      FILE="ApiPad_${VERSION}_x64.dmg"
    fi
    echo "Downloading ${FILE}..."
    curl -L "${BASE_URL}/${FILE}" -o "/tmp/${FILE}"
    echo "Opening installer..."
    open "/tmp/${FILE}"
  fi

elif [ "$OS" = "linux" ]; then
  if command -v apt-get >/dev/null 2>&1; then
    FILE="ApiPad_${VERSION}_amd64.deb"
    echo "Downloading ${FILE}..."
    curl -L "${BASE_URL}/${FILE}" -o "/tmp/${FILE}"
    sudo dpkg -i "/tmp/${FILE}"
  else
    FILE="ApiPad_${VERSION}_amd64.AppImage"
    echo "Downloading ${FILE}..."
    curl -L "${BASE_URL}/${FILE}" -o "$HOME/Applications/ApiPad.AppImage"
    chmod +x "$HOME/Applications/ApiPad.AppImage"
    echo "Installed to ~/Applications/ApiPad.AppImage"
  fi
fi

echo "Done! ApiPad installed successfully."
