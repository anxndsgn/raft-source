#!/bin/sh
# Install or upgrade this deployment's own Raft Computer build on a Mac
# (Apple silicon), next to an official Raft Computer without touching it:
#
#   curl -fsSL https://<APP_HOST>/computer/install.sh | sh
#
# - Home: ~/.raft-computer-<home name> (RAFT_HOME). The official Computer uses
#   another home and its background service is keyed by home, so both run
#   side by side.
# - Command: ~/.local/bin/raft-computer-<home name>, a wrapper that sets
#   RAFT_HOME; the official `raft-computer` command is left as it is.
# - First install: connects the machine with `setup` (approve it in the
#   browser). Run again later to upgrade: the service stops, the binary is
#   replaced and it starts again; if the new one fails, the previous one is
#   put back. Never use the web "upgrade" button or `raft-computer upgrade`
#   for this Computer: both install the official release over it.
#
# publish-time values (scripts/dev/computer-publish.sh fills them in):
BASE_URL="__BASE_URL__"
SERVER_SLUG="__SERVER_SLUG__"
SERVER_URL="__SERVER_URL__"
COMMAND_NAME="__COMMAND_NAME__"
HOME_NAME="__HOME_NAME__"
set -eu

say() { printf 'raft-computer install: %s\n' "$*"; }
die() { printf 'raft-computer install: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || die "this build is for macOS only"
[ "$(uname -m)" = arm64 ] || die "this build is for Apple silicon Macs only (this one is $(uname -m))"
command -v curl >/dev/null || die "curl is required"

RAFT_HOME="${RAFT_HOME:-$HOME/.raft-computer-$HOME_NAME}"
case "$RAFT_HOME" in "$HOME/.raft"|"$HOME/.slock"|"$HOME/.raft/"|"$HOME/.slock/") die "RAFT_HOME=$RAFT_HOME is the official Computer's home; unset it" ;; esac
export RAFT_HOME SLOCK_HOME="$RAFT_HOME" RAFT_COMPUTER_INSTALL_DIR="$RAFT_HOME/bin"
BIN="$RAFT_HOME/bin"
TARGET="$BIN/raft-computer"
PREVIOUS="$BIN/raft-computer.previous"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

fetch() { curl -fsSL --connect-timeout 30 --retry 2 "$1" -o "$2" || die "download failed: $1"; }
verify() { # verify <file> <sha256 file>
  want="$(awk '{print $1}' "$2")"
  got="$(shasum -a 256 "$1" | awk '{print $1}')"
  [ -n "$want" ] && [ "$want" = "$got" ] || die "checksum mismatch for $(basename "$1")"
}

fetch "$BASE_URL/latest" "$tmp/latest"
version="$(tr -d ' \r\n' < "$tmp/latest")"
case "$version" in ''|*[!0-9a-f]*) die "bad version in $BASE_URL/latest" ;; esac
say "downloading build $version"
for f in raft-computer-darwin-arm64.gz photon_rs_bg.wasm; do
  fetch "$BASE_URL/$version/$f" "$tmp/$f"
  fetch "$BASE_URL/$version/$f.sha256" "$tmp/$f.sha256"
  verify "$tmp/$f" "$tmp/$f.sha256"
done
gunzip "$tmp/raft-computer-darwin-arm64.gz"
NEW="$tmp/raft-computer-darwin-arm64"
chmod +x "$NEW"
"$NEW" --version >/dev/null 2>&1 || die "the downloaded binary does not run"

mkdir -p "$BIN"
put() { # put <binary> <wasm>: rename into place, never write a running file
  cp "$1" "$TARGET.new" && chmod +x "$TARGET.new" && mv -f "$TARGET.new" "$TARGET"
  if [ -f "$2" ]; then cp "$2" "$BIN/photon_rs_bg.wasm.new" && mv -f "$BIN/photon_rs_bg.wasm.new" "$BIN/photon_rs_bg.wasm"; fi
}

# The command for this Computer, under a name of its own.
mkdir -p "$HOME/.local/bin"
WRAPPER="$HOME/.local/bin/$COMMAND_NAME"
cat > "$WRAPPER.new" <<WRAP
#!/bin/sh
# $COMMAND_NAME: the Raft Computer for $SERVER_URL (installed from $BASE_URL/install.sh).
RAFT_HOME="$RAFT_HOME" SLOCK_HOME="$RAFT_HOME" RAFT_COMPUTER_INSTALL_DIR="$BIN" exec "$TARGET" "\$@"
WRAP
chmod +x "$WRAPPER.new" && mv -f "$WRAPPER.new" "$WRAPPER"

# Connected already (a server attachment exists): upgrade in place.
# Otherwise (new, or a first setup that did not finish): install and set up.
attached=0
for d in "$RAFT_HOME"/computer/servers/*/; do [ -d "$d" ] && attached=1; done
if [ ! -x "$TARGET" ] || [ "$attached" = 0 ]; then
  [ -x "$TARGET" ] && "$TARGET" stop >/dev/null 2>&1 || true
  put "$NEW" "$tmp/photon_rs_bg.wasm"
  say "installed $("$TARGET" --version) in $BIN"
  say "connecting this Mac to /$SERVER_SLUG: approve it in the browser when asked"
  if (exec </dev/tty) 2>/dev/null; then
    "$TARGET" setup "/$SERVER_SLUG" --server-url "$SERVER_URL" </dev/tty
  else
    "$TARGET" setup "/$SERVER_SLUG" --server-url "$SERVER_URL" --yes
  fi
else
  say "upgrading $("$TARGET" --version) in $BIN; the service and its agents restart"
  cp "$TARGET" "$PREVIOUS"
  [ -f "$BIN/photon_rs_bg.wasm" ] && cp "$BIN/photon_rs_bg.wasm" "$BIN/photon_rs_bg.wasm.previous"
  "$TARGET" stop || true
  put "$NEW" "$tmp/photon_rs_bg.wasm"
  if ! "$TARGET" start; then
    say "the new binary failed to start; restoring the previous one" >&2
    "$TARGET" stop || true
    put "$PREVIOUS" "$BIN/photon_rs_bg.wasm.previous"
    "$TARGET" start || die "the previous binary did not start either; check: $COMMAND_NAME doctor"
    die "upgrade failed and was rolled back"
  fi
fi

"$TARGET" status || true
say "done. This Computer's command: $COMMAND_NAME (status, logs, stop, start, doctor)"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) say "add ~/.local/bin to your PATH to run $COMMAND_NAME directly" ;; esac
say "to upgrade later, run the same install command again"
