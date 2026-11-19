#!/usr/bin/env bash
# Build Scratch Pad and install it for the current user.
# Usage: scripts/package_linux.sh [--install | --install-binary]
#   (no argument)     build dist/scratch-pad.AppImage
#   --install         build the AppImage and install it under ~/.local
#   --install-binary  build the plain release binary and install it under ~/.local with its
#                     icon and launcher entry. Use this on current Arch Linux, where the
#                     AppImage step fails inside linuxdeploy (see BUILD-NOTES.md).
set -euo pipefail

cd "$(dirname "$0")/.."
SLUG="scratch-pad"
APP_NAME='Scratch Pad'
INSTALL_DIR="$HOME/.local"

install=false
install_binary=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    --install-binary) install_binary=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ "$install_binary" = true ]; then
  npm run tauri -- build --no-bundle
  BIN="src-tauri/target/release/$SLUG"
  if [ ! -x "$BIN" ]; then
    echo "Release binary was not produced" >&2
    exit 1
  fi
  APPS="$INSTALL_DIR/share/applications"
  ICONS="$INSTALL_DIR/share/icons/hicolor"
  mkdir -p dist "$INSTALL_DIR/bin" "$APPS" "$ICONS/scalable/apps"
  cp "$BIN" "dist/$SLUG"
  if [ -f "$INSTALL_DIR/bin/$SLUG" ]; then
    mkdir -p dist/rollback
    cp "$INSTALL_DIR/bin/$SLUG" "dist/rollback/$SLUG"
  fi
  install -m755 "dist/$SLUG" "$INSTALL_DIR/bin/$SLUG"
  install -m644 app-icon.svg "$ICONS/scalable/apps/$SLUG.svg"
  # One name for the binary, the launcher entry, the icon and the window class, so the
  # compositor and the launcher match the window to this entry.
  cat > "$APPS/$SLUG.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=One note, saved as you type
Exec=env GDK_BACKEND=wayland "$INSTALL_DIR/bin/$SLUG"
Icon=$SLUG
Terminal=false
Categories=Utility;TextEditor;
StartupWMClass=$SLUG
DESKTOP
  # Left behind by earlier installs under the old names.
  rm -f "$APPS/com.scratch.pad.desktop" "$ICONS/128x128/apps/$SLUG.png"
  command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" || true
  command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$ICONS" || true
  echo "Installed $APP_NAME as $INSTALL_DIR/bin/$SLUG"
  exit 0
fi

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
Type=Application
Name=$APP_NAME
Comment=One note, saved as you type
Exec=env GDK_BACKEND=wayland "$INSTALL_DIR/bin/$SLUG.AppImage"
Icon=$SLUG
Terminal=false
Categories=Utility;TextEditor;
StartupWMClass=com.scratch.pad
DESKTOP
echo "Installed $APP_NAME under $INSTALL_DIR"
