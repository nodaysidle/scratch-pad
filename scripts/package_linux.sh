#!/usr/bin/env bash
# Build an AppImage, install it for the current user, and add the desktop entry.
# Usage: scripts/package_linux.sh [--install]
set -euo pipefail

cd "$(dirname "$0")/.."
SLUG="scratch-pad"
APP_NAME='Scratch Pad'
INSTALL_DIR="$HOME/.local"

install=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f src-tauri/icons/128x128.png ] || npm run tauri -- icon app-icon.svg
npm run tauri -- build --bundles appimage

mkdir -p dist
APPIMAGE="$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -name '*.AppImage' | head -1)"
if [ -z "$APPIMAGE" ]; then
  echo "AppImage was not produced" >&2
  exit 1
fi
cp "$APPIMAGE" "dist/$SLUG.AppImage"

if [ "$install" = false ]; then
  echo "Built dist/$SLUG.AppImage; rerun with --install to install it."
  exit 0
fi

mkdir -p "$INSTALL_DIR/bin" "$INSTALL_DIR/share/applications" "$INSTALL_DIR/share/icons/hicolor/128x128/apps"
if [ -f "$INSTALL_DIR/bin/$SLUG.AppImage" ]; then
  mkdir -p dist/rollback
  cp "$INSTALL_DIR/bin/$SLUG.AppImage" "dist/rollback/$SLUG.AppImage"
fi
install -m755 "dist/$SLUG.AppImage" "$INSTALL_DIR/bin/$SLUG.AppImage"
install -m644 src-tauri/icons/128x128.png "$INSTALL_DIR/share/icons/hicolor/128x128/apps/$SLUG.png"
cat > "$INSTALL_DIR/share/applications/com.scratch.pad.desktop" <<DESKTOP
[Desktop Entry]
Name=$APP_NAME
Comment=$APP_NAME
Exec=env GDK_BACKEND=wayland $INSTALL_DIR/bin/$SLUG.AppImage
Icon=$SLUG
Terminal=false
Type=Application
Categories=Utility;
StartupWMClass=com.scratch.pad
DESKTOP
echo "Installed $APP_NAME under $INSTALL_DIR"
