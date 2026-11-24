#!/usr/bin/env bash
# Install the prebuilt Scratch Pad from a release archive for the current user.
# Usage: ./install.sh              install under ~/.local (binary, icon, launcher entry)
#        ./install.sh --uninstall  remove what it installed (your note is kept)
# Set PREFIX to install somewhere else, for example PREFIX=/tmp/try ./install.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SLUG="scratch-pad"
PREFIX="${PREFIX:-$HOME/.local}"
BIN="$PREFIX/bin/$SLUG"
APPS="$PREFIX/share/applications"
ICONS="$PREFIX/share/icons/hicolor"

refresh() {
  command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" 2>/dev/null || true
  command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$ICONS" 2>/dev/null || true
}

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$BIN" "$APPS/$SLUG.desktop" "$ICONS/scalable/apps/$SLUG.svg"
  refresh
  echo "Removed Scratch Pad from $PREFIX. Your note stays in ~/.local/share/com.scratch.pad/."
  exit 0
fi
if [ -n "${1:-}" ]; then
  echo "Unknown argument: $1" >&2
  exit 2
fi

# The archive holds the binary next to this script; in a source checkout it is in the build folder.
SRC="$HERE/$SLUG"
[ -x "$SRC" ] || SRC="$HERE/../src-tauri/target/release/$SLUG"
ICON="$HERE/app-icon.svg"
[ -f "$ICON" ] || ICON="$HERE/../app-icon.svg"
if [ ! -x "$SRC" ] || [ ! -f "$ICON" ]; then
  echo "The scratch-pad binary or app-icon.svg was not found next to this script." >&2
  exit 1
fi

# The binary needs these two system libraries; say so now rather than failing at launch.
if command -v ldconfig >/dev/null; then
  # Read the list once: with pipefail, grep -q closing the pipe early would look like a failure.
  known="$(ldconfig -p 2>/dev/null || true)"
  for lib in libwebkit2gtk-4.1.so.0 libgtk-3.so.0; do
    if [ -n "$known" ] && ! grep -q "$lib" <<<"$known"; then
      echo "Missing $lib. Install webkit2gtk 4.1 and GTK 3 first (see the README), then run this again." >&2
      exit 1
    fi
  done
fi

mkdir -p "$PREFIX/bin" "$APPS" "$ICONS/scalable/apps"
install -m755 "$SRC" "$BIN"
install -m644 "$ICON" "$ICONS/scalable/apps/$SLUG.svg"
# One name for the binary, the launcher entry, the icon and the window class, so the
# compositor and the launcher match the window to this entry.
cat > "$APPS/$SLUG.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Scratch Pad
Comment=One note, saved as you type
Exec=env GDK_BACKEND=wayland "$BIN"
Icon=$SLUG
Terminal=false
Categories=Utility;TextEditor;
StartupWMClass=$SLUG
DESKTOP
refresh

echo "Installed Scratch Pad as $BIN"
case ":$PATH:" in
  *":$PREFIX/bin:"*) ;;
  *) echo "Note: $PREFIX/bin is not on your PATH; start it from your app launcher or by its full path." ;;
esac
